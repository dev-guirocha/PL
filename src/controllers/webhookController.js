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
      const transactionId = charge.correlationID;
      const value = Number(charge.value) / 100; // centavos -> reais

      console.log(`💰 Pagamento Confirmado: ${transactionId} - R$ ${value}`);

      // Exemplo de atualização de base (ajuste à sua regra de crédito):
      // await prisma.pixCharge.update({
      //   where: { txid: transactionId },
      //   data: { status: 'PAID', paidAt: new Date() },
      // });
      // TODO: adicionar crédito ao saldo do usuário relacionado.
    }

    // Sempre 200 para evitar bloqueio/reenvio
    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erro no Webhook OpenPix:', error);
    // Mesmo com erro interno, retornamos 500; se preferir não travar a fila, pode retornar 200 aqui.
    return res.status(500).send('Erro interno');
  }
};
