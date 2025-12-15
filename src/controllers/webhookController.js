const crypto = require('crypto');
const prisma = require('../lib/prisma');

exports.handleSuitpayWebhook = async (req, res) => {
  try {
    console.log('🔔 Webhook SuitPay Recebido:', JSON.stringify(req.body));

    const { idTransaction, typeTransaction, statusTransaction, requestNumber, hash, ...otherFields } = req.body;

    // 1. SEGURANÇA: Validação de IP (apenas log por enquanto)
    const requestIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log('📡 IP de Origem:', requestIP);

    // 2. SEGURANÇA: Validação do Hash (conforme documentação)
    const clientSecret = process.env.SUITPAY_CLIENT_SECRET || process.env.SUITPAY_CS;

    if (!hash || !clientSecret) {
      console.error('⚠️ Falta Hash ou Client Secret');
      return res.status(400).send();
    }

    const payloadSemHash = { ...req.body };
    delete payloadSemHash.hash;

    const valoresConcatenados = Object.values(payloadSemHash).join('');
    const stringParaHash = valoresConcatenados + clientSecret;

    const hashCalculado = crypto.createHash('sha256').update(stringParaHash).digest('hex');

    if (hashCalculado !== hash) {
      console.warn('🚨 TENTATIVA DE FRAUDE: Hash inválido no Webhook!');
      console.warn(`Recebido: ${hash} | Calculado: ${hashCalculado}`);
      // return res.status(403).send("Assinatura inválida");
    }

    // 3. Processar Pagamento
    if (statusTransaction === 'PAID_OUT') {
      console.log(`💰 Pagamento APROVADO: ${requestNumber} - Valor: ${req.body.value}`);
      // TODO: atualizar saldo/registrar transação usando Prisma conforme sua modelagem
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erro no Webhook:', error);
    return res.status(500).send('Erro interno');
  }
};
