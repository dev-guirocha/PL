const { createClient } = require('@woovi/node-sdk');

// Inicializa o cliente OpenPix com o AppID configurado no ambiente (OPENPIX_APP_ID)
const woovi = createClient({
  appId: process.env.OPENPIX_APP_ID,
});

exports.createPixCharge = async (req, res) => {
  try {
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

    return res.json({
      success: true,
      correlationID: charge.correlationID,
      brCode: charge.brCode,
      qrCodeImage: charge.qrCodeImage,
    });
  } catch (error) {
    console.error('❌ Erro OpenPix:', error);
    return res.status(500).json({ error: 'Erro ao gerar Pix' });
  }
};
