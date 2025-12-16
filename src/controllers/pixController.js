const prisma = require('../utils/prismaClient');
const woovi = require('../lib/wooviClient');

exports.createPixCharge = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      console.warn('⚠️ Tentativa de criar Pix sem usuário autenticado.');
      return res.status(401).json({ error: 'Usuário não identificado.' });
    }

    const { amount, cpf, nome, email } = req.body;

    // Validações básicas
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    const valueFloat = Number(amount);

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    // OpenPix trabalha em centavos
    const valueInCents = Math.round(valueFloat * 100);
    const bonusAmount = Number((valueFloat * 0.15).toFixed(2)); // bônus fixo de 15%
    const correlationID = `pix-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    console.log('🚀 [OpenPix] Criando cobrança:', correlationID, valueInCents);

    const created = await woovi.charge.create({
      correlationID,
      value: valueInCents,
      comment: 'Recarga Plataforma',
      customer: {
        name: nome || 'Cliente',
        taxID: cleanCpf,
        email: email || 'email@exemplo.com',
      },
    });

    // Estrutura de retorno pode variar; coleta dos caminhos mais comuns
    const charge = created?.charge || {};
    const pix = charge?.paymentMethods?.pix || {};

    const brCode = created?.brCode || charge?.brCode || pix?.brCode || null;
    const qrCodeImage = charge?.qrCodeImage || pix?.qrCodeImage || null;
    const paymentLinkUrl = charge?.paymentLinkUrl || null;
    const identifier = charge?.identifier || pix?.identifier || null;
    const txid = pix?.txId || charge?.transactionID || null;

    if (!brCode || !qrCodeImage) {
      console.warn('⚠️ Missing fields:', { brCode: !!brCode, qrCodeImage: !!qrCodeImage });
    }

    // Persiste a cobrança como pendente para reconciliar no webhook
    await prisma.pixCharge.create({
      data: {
        userId: Number(userId),
        amount: valueFloat,
        bonusAmount,
        status: 'pending',
        txid: txid || correlationID,
        copyAndPaste: brCode,
        qrCodeImage: qrCodeImage,
      },
    });

    return res.json({
      success: true,
      correlationID,
      brCode,
      qrCodeImage,
      paymentLinkUrl,
      identifier,
      bonusAmount,
    });
  } catch (err) {
    // LOG DE DEPURAÇÃO (AXIOS/SDK)
    console.error('❌ Axios/Woovi message:', err.message);
    console.error('❌ Status:', err.response?.status);
    console.error('❌ Data:', err.response?.data);
    console.error('❌ Headers:', err.response?.headers);
    if (!err.response) console.error('❌ stack:', err.stack);

    const status = err.response?.status || 500;

    return res.status(status).json({
      error: 'Erro ao gerar Pix',
      status,
      data: err.response?.data,
      message: err.message,
    });
  }
};
