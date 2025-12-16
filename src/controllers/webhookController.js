const crypto = require('crypto');
const prisma = require('../utils/prismaClient');

// Webhook OpenPix
exports.handleOpenPixWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-openpix-authorization'] || req.headers.authorization || req.headers['x-webhook-signature'];
    // Para depuração inicial, você pode logar os headers e validar HMAC/Authorization conforme configurado no painel.
    // console.log('Headers recebidos:', req.headers, 'Assinatura:', signature);

    const { event, charge } = req.body || {};
    if (!event || !charge) {
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

    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erro no Webhook OpenPix:', error);
    return res.status(500).send('Erro interno');
  }
};
