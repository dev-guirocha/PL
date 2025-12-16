const { createClient } = require('@woovi/node-sdk');
const prisma = require('../utils/prismaClient');

// Normaliza AppID (evita quebras de linha invisíveis)
const appId = (process.env.OPENPIX_APP_ID || '').trim();
console.log('[OpenPix] appId len:', appId.length);
console.log('[OpenPix] appId head:', appId.slice(0, 8));

// Inicializa o cliente OpenPix com AppID e base da OpenPix (Enterprise)
// Não incluir /api/v1 no baseUrl, o SDK já adiciona o path das rotas
const woovi = createClient({
  appId,
  baseUrl: 'https://api.openpix.com.br',
});

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
    const correlationID = `pix-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    console.log('🚀 [OpenPix] Criando cobrança:', correlationID, valueInCents);

    const { charge } = await woovi.charge.create({
      correlationID,
      value: valueInCents,
      comment: 'Recarga Plataforma',
      customer: {
        name: nome || 'Cliente',
        taxID: cleanCpf,
        email: email || 'email@exemplo.com',
      },
    });

    console.log('✅ Cobrança criada:', charge.correlationID);

    // Persiste a cobrança como pendente para reconciliar no webhook
    await prisma.pixCharge.create({
      data: {
        userId: Number(userId),
        amount: valueFloat,
        status: 'pending',
        txid: charge.correlationID,
        copyAndPaste: charge.brCode,
        qrCodeImage: charge.qrCodeImage,
      },
    });

    return res.json({
      success: true,
      correlationID: charge.correlationID,
      brCode: charge.brCode,
      qrCodeImage: charge.qrCodeImage,
    });
  } catch (err) {
    // LOG DE DEPURAÇÃO (AXIOS/SDK)
    console.error('❌ Axios/Woovi message:', err.message);
    console.error('❌ Status:', err.response?.status);
    console.error('❌ Data:', err.response?.data);
    console.error('❌ Headers:', err.response?.headers);

    const errorMsg = err.response?.data?.error || err.message || JSON.stringify(err);

    return res.status(500).json({
      error: 'Erro ao gerar Pix',
      details: errorMsg,
    });
  }
};
