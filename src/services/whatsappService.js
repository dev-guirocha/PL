const axios = require('axios');

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

exports.sendRecoveryCode = async (phone, code) => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const targetPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const message = `🔐 *Panda Loterias*\n\nSeu código de recuperação é: *${code}*\n\nEle expira em 10 minutos. Se você não solicitou, ignore esta mensagem.`;

  if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
    console.warn('Z-API não configurado (ZAPI_INSTANCE/ZAPI_TOKEN ausentes). Código não enviado.');
    return { success: false, detail: 'missing-config' };
  }

  try {
    await axios.post(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      {
        phone: targetPhone,
        message,
      },
    );
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error.response?.data || error.message);
    return { success: false, detail: error.response?.data || error.message };
  }
};
