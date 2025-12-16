const prisma = require('../utils/prismaClient');

// Webhook Woovi/OpenPix
exports.handleOpenPixWebhook = async (req, res) => {
  console.log('🔔 Webhook Woovi recebido:', JSON.stringify(req.body));

  try {
    // Normaliza payload: charge pode vir no topo ou em data.charge
    const charge = req.body?.charge || req.body?.data?.charge || req.body;
    const pix = charge?.paymentMethods?.pix;

    if (!charge || !pix) {
      console.warn('⚠️ Payload sem charge/pix, ignorando.');
      return res.status(200).send('OK');
    }

    const status = pix.status || charge.status;
    const isPaid =
      String(status || '').toUpperCase().includes('COMPLETE') ||
      String(status || '').toUpperCase().includes('PAID') ||
      String(status || '').toUpperCase().includes('CONFIRMED');

    if (!isPaid) {
      return res.status(200).send('OK');
    }

    const correlationID = charge.correlationID;
    const txId = pix.txId;

    const pixCharge = await prisma.pixCharge.findFirst({
      where: {
        OR: [
          txId ? { txid: txId } : undefined,
          correlationID ? { txid: correlationID } : undefined,
        ].filter(Boolean),
      },
    });

    if (!pixCharge || pixCharge.credited) {
      console.warn('⚠️ Cobrança não encontrada ou já creditada:', { correlationID, txId });
      return res.status(200).send('OK');
    }

    const value = Number(pixCharge.amount);

    await prisma.$transaction([
      prisma.pixCharge.update({
        where: { id: pixCharge.id },
        data: {
          status: 'paid',
          credited: true,
          paidAt: new Date(),
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
          type: 'PIX_DEPOSIT',
          amount: value,
          description: `Depósito Pix (${txId || correlationID})`,
        },
      }),
    ]);

    console.log('✅ Pix creditado com sucesso');
    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erro no Webhook Woovi:', error);
    // Evita loop de reenvio infinito; ajuste para 500 se quiser reprocessar
    return res.status(200).send('OK');
  }
};
