exports.createPixCharge = async (req, res) => {
  try {
    const { amount, cpf, nome, email } = req.body;

    // 1. Definição da URL
    const baseUrlEnv = process.env.SUITPAY_BASE_URL || process.env.SUITPAY_URL;
    let finalUrl = baseUrlEnv;

    // Garante que termina com /gateway/request-qrcode
    if (finalUrl && !finalUrl.includes('request-qrcode')) {
      finalUrl = `${finalUrl.replace(/\/$/, '')}/gateway/request-qrcode`;
    }

    console.log('🚀 [FETCH] Disparando para:', finalUrl);

    // 2. Credenciais
    const clientID = process.env.SUITPAY_CLIENT_ID || process.env.SUITPAY_CI;
    const clientSecret = process.env.SUITPAY_CLIENT_SECRET || process.env.SUITPAY_CS;

    if (!clientID || !clientSecret) {
      throw new Error('Credenciais Suitpay não encontradas no Railway.');
    }

    // 3. Validação e Tratamento
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    const valueFloat = Number(amount);

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido ou não informado.' });
    }

    const payload = {
      // Usa um identificador sempre único para evitar bloqueio por reuso
      requestNumber: `pix-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

    console.log('📦 Payload:', JSON.stringify(payload));

    // 4. DISPARO COM FETCH (Ignora configs globais do Axios)
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        ci: clientID,
        cs: clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'manual',
    });

    console.log('ℹ️ SuitPay status:', response.status, response.statusText, 'url:', response.url);
    const location = response.headers.get('location');
    if (location) console.warn('➡️ Redirect location:', location);
    const serverHeader = response.headers.get('server') || response.headers.get('x-powered-by');
    if (serverHeader) console.log('ℹ️ Response server:', serverHeader);

    // 5. Tratamento da Resposta
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ ERRO API SUITPAY:', JSON.stringify(data, null, 2));
      return res.status(response.status).json(data);
    }

    console.log('✅ SUCESSO:', data);

    return res.json({
      success: true,
      correlationID: data.idTransaction,
      brCode: data.paymentCode,
      qrCodeImage: data.paymentUrl,
    });
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
    return res.status(500).json({ error: 'Erro interno ao gerar PIX' });
  }
};
