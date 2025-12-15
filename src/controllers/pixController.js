const axios = require('axios');

exports.createPixCharge = async (req, res) => {
  try {
    const { amount, cpf, nome, email } = req.body;
    console.log('📦 DADOS QUE CHEGARAM DO SITE:', req.body);

    // 1. Definição da URL
    // Pega SUITPAY_BASE_URL ou SUITPAY_URL
    const baseUrlEnv = process.env.SUITPAY_BASE_URL || process.env.SUITPAY_URL;
    let finalUrl = baseUrlEnv;

    // Garante que termina com /gateway/request-qrcode
    if (finalUrl && !finalUrl.includes('request-qrcode')) {
      finalUrl = `${finalUrl.replace(/\/$/, '')}/gateway/request-qrcode`;
    }

    console.log('🚀 Iniciando Suitpay em:', finalUrl);

    // 2. Busca Credenciais (Compatível com seus nomes no Railway)
    const clientID = process.env.SUITPAY_CLIENT_ID || process.env.SUITPAY_CI;
    const clientSecret = process.env.SUITPAY_CLIENT_SECRET || process.env.SUITPAY_CS;

    if (!clientID || !clientSecret) {
      throw new Error('Credenciais (Client ID / Secret) não configuradas no Railway.');
    }

    // 3. Preparação dos Dados
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    const valueFloat = Number(amount);

    // Validação defensiva de CPF antes de chamar a Suitpay
    console.log('🔍 CPF Processado:', cleanCpf);
    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({
        error: 'CPF Inválido',
        message: 'O CPF deve conter 11 números. Verifique o cadastro.',
      });
    }

    const payload = {
      requestNumber: `pix-${Date.now()}`,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: valueFloat,
      shippingAmount: 0.0,
      usernameCheckout: 'checkout',
      callbackUrl: `${process.env.BACKEND_URL || process.env.API_URL}/api/webhook/suitpay`,
      client: {
        name: nome || 'Cliente',
        document: cleanCpf,
        email: email || 'email@exemplo.com',
      },
    };

    // 4. Cria instância isolada do Axios
    const api = axios.create();

    // 5. Envia Requisição
    const response = await api.post(finalUrl, payload, {
      headers: {
        ci: clientID,
        cs: clientSecret,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Sucesso Suitpay:', response.data);

    const data = response.data;
    return res.json({
      success: true,
      correlationID: data.idTransaction,
      brCode: data.paymentCode,
      qrCodeImage: data.paymentUrl,
    });
  } catch (error) {
    // Logs de erro detalhados
    if (error.response) {
      console.error('❌ ERRO SUITPAY:', JSON.stringify(error.response.data, null, 2));
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('❌ ERRO INTERNO:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar PIX' });
  }
};
