const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EFI_BASE_URL = process.env.EFI_BASE_URL || 'https://pix-h.efipay.com.br';
const EFI_CLIENT_ID = process.env.EFI_CLIENT_ID || '';
const EFI_CLIENT_SECRET = process.env.EFI_CLIENT_SECRET || '';
const EFI_PIX_KEY = process.env.EFI_PIX_KEY || '';
const SUITPAY_WEBHOOK_TOKEN = (process.env.SUITPAY_WEBHOOK_TOKEN || '').trim();
const MIN_WEBHOOK_TOKEN_LENGTH = 32;

// Gera txid simples para teste (troque por geração conforme regras do BACEN se necessário)
function generateTxid() {
  return `TX${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function getEfiToken() {
  // Esqueleto para obter token OAuth da Efí.
  // TODO: Ajustar grant_type/client credentials conforme documentação oficial.
  const basic = Buffer.from(`${EFI_CLIENT_ID}:${EFI_CLIENT_SECRET}`).toString('base64');
  const res = await axios.post(
    `${EFI_BASE_URL}/oauth/token`,
    { grant_type: 'client_credentials' },
    {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return res.data?.access_token;
}

exports.createCharge = async (req, res) => {
  const { amount } = req.body;
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valor inválido.' });
  }

  const value = Number(amount);
  const txid = generateTxid();

  try {
    // Salva cobrança antes de chamar provedor (estado created)
    const charge = await prisma.pixCharge.create({
      data: {
        userId: req.userId,
        amount: value,
        status: 'created',
        txid,
      },
    });

    // Obtém token da Efí (sandbox/produção conforme BASE_URL)
    const token = await getEfiToken();

    // Esqueleto da criação de cobrança imediata na Efí
    // TODO: Ajustar payload conforme API Efí (campo calendario, valor.original, chave etc.)
    const payload = {
      calendario: { expiracao: 3600 },
      devedor: {},
      valor: { original: value.toFixed(2) },
      chave: EFI_PIX_KEY,
      solicitacaoPagador: 'Recarga Pix',
    };

    let efiResponse;
    try {
      efiResponse = await axios.put(`${EFI_BASE_URL}/v2/cob/${txid}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      // Falhou no provedor; marca cobrança como failed
      await prisma.pixCharge.update({
        where: { id: charge.id },
        data: { status: 'failed' },
      });
      return res.status(502).json({ error: 'Erro ao criar cobrança Pix (Efí).' });
    }

    const { loc, pixCopiaECola, qrCode } = efiResponse.data || {};

    const updated = await prisma.pixCharge.update({
      where: { id: charge.id },
      data: {
        status: 'pending',
        locId: loc?.id ? String(loc.id) : null,
        copyAndPaste: pixCopiaECola || null,
        qrCodeImage: qrCode || null,
        expiresAt: loc?.criacao ? new Date(Date.now() + 3600 * 1000) : null,
      },
    });

    return res.json({
      id: updated.id,
      txid: updated.txid,
      status: updated.status,
      copyAndPaste: updated.copyAndPaste,
      qrCode: updated.qrCodeImage,
      expiresAt: updated.expiresAt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar cobrança.' });
  }
};

exports.handleWebhook = async (req, res) => {
  // Validação do webhook SuitPay via header de assinatura ou token de URL
  if (!SUITPAY_WEBHOOK_TOKEN || SUITPAY_WEBHOOK_TOKEN.length < MIN_WEBHOOK_TOKEN_LENGTH) {
    console.error('Webhook SuitPay não configurado com token forte. Defina um SUITPAY_WEBHOOK_TOKEN longo/aleatório no .env.');
    return res.status(500).json({ error: 'Webhook indisponível por configuração insegura.' });
  }

  const signatureHeader = req.get('x-suitpay-signature');
  const tokenFromHeader = req.get('x-webhook-token');
  const tokenFromQuery = req.query?.token;
  const providedSecret = signatureHeader || tokenFromHeader || tokenFromQuery;

  if (!providedSecret || providedSecret !== SUITPAY_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
  }

  // Esqueleto de webhook: espera receber txid e status pago
  // Ajuste conforme payload real da Efí (provavelmente em req.body.pix[0].txid)
  const { txid, status } = req.body || {};

  if (!txid) {
    return res.status(400).json({ error: 'txid ausente.' });
  }

  try {
    const charge = await prisma.pixCharge.findUnique({ where: { txid } });
    if (!charge) {
      return res.status(404).json({ error: 'Cobrança não encontrada.' });
    }

    // Só credita uma vez
    if (status === 'CONCLUIDA' || status === 'paid') {
      await prisma.$transaction([
        prisma.pixCharge.update({
          where: { id: charge.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
            credited: true,
          },
        }),
        prisma.user.update({
          where: { id: charge.userId },
          data: { balance: { increment: charge.amount } },
        }),
      ]);
    } else {
      await prisma.pixCharge.update({
        where: { id: charge.id },
        data: { status: status?.toLowerCase?.() || 'unknown' },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar webhook.' });
  }
};
