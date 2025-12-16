const crypto = require('crypto');
const prisma = require('../utils/prismaClient');

// Webhook OpenPix
exports.handleOpenPixWebhook = async (req, res) => {
  // Log básico para depuração no deploy
  console.log('🔔 Webhook OpenPix Recebido:', JSON.stringify(req.body));

  try {
    // 1) Ping de teste do painel (não traz charge) precisa retornar 200
    if (req.body?.evento === 'teste_webhook') {
      console.log('✅ Evento de teste aprovado.');
      return res.status(200).send({ message: 'Webhook configurado com sucesso' });
    }

    // 2) Assinatura (mantida para futura validação HMAC)
    const signature = req.headers['x-openpix-authorization'] || req.headers.authorization || req.headers['x-webhook-signature'];
    // TODO: validar HMAC/Authorization conforme configuração do painel

    const { event, charge } = req.body || {};
    if (!event || !charge) {
      console.warn('⚠️ Payload incompleto recebido');
      return res.status(400).send('Payload inválido');
    }

    console.log(`🔔 Webhook OpenPix: ${event} | Status: ${charge.status}`);

    if (event === 'OPENPIX:CHARGE_COMPLETED' || charge.status === 'COMPLETED') {
      const correlationID = charge.correlationID;
      const identifier = charge.identifier;
      const transactionID = charge.transactionID || charge.transactionId;
      const pixTxId = charge.paymentMethods?.pix?.txId;

      // Tenta casar pelo txid salvo (correlationID ou txId/identifier)
      const pixCharge = await prisma.pixCharge.findFirst({
        where: {
          OR: [
            { txid: correlationID },
            identifier ? { txid: identifier } : undefined,
            transactionID ? { txid: transactionID } : undefined,
            pixTxId ? { txid: pixTxId } : undefined,
          ].filter(Boolean),
        },
        include: { user: true },
      });

      if (!pixCharge) {
        console.error('⚠️ Cobrança não encontrada no banco para IDs:', {
          correlationID,
          identifier,
          transactionID,
          pixTxId,
        });
        return res.status(200).send('OK');
      }

      if (pixCharge.status === 'paid' || pixCharge.credited) {
        console.log(`ℹ️ Cobrança já processada: ${pixCharge.txid}`);
        return res.status(200).send('OK');
      }

      const value = Number(pixCharge.amount);
      console.log(`💰 Processando crédito: ${pixCharge.txid} - Usuário: ${pixCharge.userId} - Valor: R$ ${value}`);

      // Transação atômica: marca pago, credita saldo e registra extrato
      await prisma.$transaction([
        prisma.pixCharge.update({
          where: { id: pixCharge.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
            credited: true,
          },
        }),
        prisma.user.update({
          where: { id: pixCharge.userId },
          data: {
            balance: { increment: value },
          },
        }),
        prisma.transaction.create({
          data: {
            userId: pixCharge.userId,
            type: 'deposit',
            amount: value,
            description: `Depósito via Pix (TxID: ${transactionId})`,
          },
        }),
      ]);

      console.log(`✅ Saldo creditado para User ID ${pixCharge.userId}`);
    }

    // Sempre 200 para evitar bloqueio/reenvio
    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erro no Webhook OpenPix:', error);
    // Mesmo com erro interno, retornamos 500; se preferir não travar a fila, pode retornar 200 aqui.
    return res.status(500).send('Erro interno');
  }
};
