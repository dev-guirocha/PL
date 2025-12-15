const axios = require('axios');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../utils/prismaClient');

const amountSchema = z.preprocess(
  (val) => Number(val),
  z.number({ required_error: 'Valor inválido.' }).positive('O valor deve ser maior que zero.'),
);

const suitPayApi = axios.create({
  baseURL: process.env.SUITPAY_BASE_URL || 'https://ws.suitpay.app/api/v1',
  headers: {
    'Content-Type': 'application/json',
    ci: process.env.SUITPAY_CLIENT_ID,
    cs: process.env.SUITPAY_CLIENT_SECRET,
  },
});

exports.createCharge = async (req, res) => {
  const parsed = amountSchema.safeParse(req.body.amount);
  if (!parsed.success) return res.status(400).json({ error: 'Valor inválido.' });

  const couponCode = (req.body?.coupon || req.body?.couponCode || '').trim().toUpperCase();

  const amount = parsed.data;
  const userId = req.userId;
  const correlationId = `deposit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const amountInCents = Math.round(Number(amount) * 100);
  if (Number.isNaN(amountInCents) || amountInCents < 100) {
    return res.status(400).json({ error: 'Valor mínimo para depósito é R$ 1,00.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, cpf: true },
    });

    const cleanCpf = (user?.cpf || '').replace(/\D/g, '');
    if (!user || !cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF obrigatório para gerar PIX.' });
    }

    let coupon = null;
    let bonusAmount = 0;

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      const now = new Date();
      const usageLimit = coupon?.usageLimit;
      const isExpired = coupon?.expiresAt && coupon.expiresAt < now;
      const limitReached = typeof usageLimit === 'number' && coupon.usedCount >= usageLimit;

      if (!coupon || !coupon.active || isExpired || limitReached) {
        return res.status(400).json({ error: 'Cupom inválido ou inativo.' });
      }

      if (coupon.type === 'percent') {
        bonusAmount = Number(((amount * Number(coupon.amount)) / 100).toFixed(2));
      } else {
        bonusAmount = Number(coupon.amount);
      }
    }

    const tempId = `REQ-${Date.now()}`;
    const charge = await prisma.pixCharge.create({
      data: {
        userId,
        amount,
        status: 'pending',
        txid: tempId,
        couponId: coupon?.id || null,
        couponCode: couponCode || null,
        bonusAmount,
      },
    });

    const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:4000';
    const tokenParam = process.env.SUITPAY_WEBHOOK_TOKEN ? `?token=${process.env.SUITPAY_WEBHOOK_TOKEN}` : '';
    const callbackUrl = `${backendUrl.replace(/\/$/, '')}/api/pix/webhook${tokenParam}`;

    const payload = {
      correlationID: correlationId,
      requestNumber: String(charge.id),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: amountInCents, // centavos, conforme APIs que exigem inteiro
      shippingAmount: 0.0,
      usernameCheckout: 'checkout',
      callbackUrl,
      client: {
        name: user.name || 'Cliente',
        document: cleanCpf,
        email: user.email || 'cliente@plataforma.com',
      },
      type: 'DYNAMIC',
    };

    const response = await suitPayApi.post('/gateway/request-qrcode', payload);

    if (response.data.response !== 'OK') {
      console.error('Erro SuitPay:', response.data);
      await prisma.pixCharge.update({ where: { id: charge.id }, data: { status: 'failed' } });
      throw new Error('Falha no gateway de pagamento.');
    }

    const { idTransaction, paymentCode, paymentCodeBase64 } = response.data;

    const updated = await prisma.pixCharge.update({
      where: { id: charge.id },
      data: {
        txid: String(idTransaction),
        copyAndPaste: paymentCode,
        qrCodeImage: paymentCodeBase64,
        locId: String(idTransaction),
      },
    });

    return res.json({
      copyAndPaste: updated.copyAndPaste,
      qrCode: updated.qrCodeImage,
      txid: updated.txid,
      bonusAmount,
      couponCode: couponCode || null,
    });
  } catch (error) {
    if (error.response) {
      console.error('❌ ERRO OPENPIX STATUS:', error.response.status);
      console.error('❌ ERRO OPENPIX DADOS:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ ERRO PIX:', error.message);
    }
    return res.status(500).json({
      error: 'Erro ao gerar PIX.',
      details: error.response?.data?.error || error.response?.data?.message || undefined,
    });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const secret = process.env.SUITPAY_WEBHOOK_SECRET || process.env.SUITPAY_CLIENT_SECRET;
    const { token } = req.query;
    const { idTransaction, typeTransaction, statusTransaction, value, payerName, payerTaxId, paymentDate, paymentCode, requestNumber, hash } = req.body || {};

    if (!idTransaction) return res.status(400).json({ error: 'Dados inválidos.' });

    // Validação de integridade conforme SuitPay (concatenação + SHA-256)
    if (hash && secret) {
      const parts = [
        idTransaction,
        typeTransaction,
        statusTransaction,
        value,
        payerName,
        payerTaxId,
        paymentDate,
        paymentCode,
        requestNumber,
      ].map((p) => (p === undefined || p === null ? '' : String(p)));
      const concatenated = parts.join('') + secret;
      const computed = crypto.createHash('sha256').update(concatenated).digest('hex');
      if (computed !== hash) {
        console.warn('[PIX] Hash inválido', { idTransaction, statusTransaction });
        return res.status(403).json({ error: 'Hash inválido.' });
      }
    } else if (process.env.SUITPAY_WEBHOOK_TOKEN) {
      if (token !== process.env.SUITPAY_WEBHOOK_TOKEN) {
        console.warn('[PIX] Token inválido no webhook', { token });
        return res.status(403).json({ error: 'Token inválido.' });
      }
    }

    const charge = await prisma.pixCharge.findFirst({
      where: { txid: String(idTransaction) },
    });

    if (!charge) return res.status(200).json({ message: 'Cobrança não encontrada (ignorado).' });

    const paidStatuses = ['PAID_OUT', 'PAYMENT_CONFIRMED', 'COMPLETED', 'PAID', 'RECEIVABLE'];
    const isPaid = paidStatuses.includes((statusTransaction || '').toUpperCase());
    const isChargeback = (statusTransaction || '').toUpperCase() === 'CHARGEBACK';

    if (isPaid && !charge.credited) {
      console.log('[PIX] Crédito aprovado', { idTransaction, value, statusTransaction, requestNumber });
      await prisma.$transaction(async (tx) => {
        await tx.pixCharge.update({
          where: { id: charge.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
            credited: true,
          },
        });

        await tx.user.update({
          where: { id: charge.userId },
          data: { balance: { increment: charge.amount } },
        });

        await tx.transaction.create({
          data: {
            userId: charge.userId,
            type: 'deposit',
            amount: charge.amount,
            description: `Depósito PIX (SuitPay #${idTransaction})`,
          },
        });

        if (charge.bonusAmount && Number(charge.bonusAmount) > 0) {
          await tx.user.update({
            where: { id: charge.userId },
            data: { bonus: { increment: charge.bonusAmount } },
          });
          await tx.transaction.create({
            data: {
              userId: charge.userId,
              type: 'bonus',
              amount: charge.bonusAmount,
              description: `Bônus cupom ${charge.couponCode || ''}`.trim(),
            },
          });
        }

        if (charge.couponId) {
          await tx.coupon.update({
            where: { id: charge.couponId },
            data: { usedCount: { increment: 1 } },
          });
        }
      });
      console.log(`[Webhook] Pix ${idTransaction} processado com sucesso.`);
    }

    // Atualiza status intermediário (ex.: PROCESSING) mesmo sem crédito
    if (!isPaid && !isChargeback && statusTransaction && charge.status !== statusTransaction.toLowerCase()) {
      await prisma.pixCharge.update({
        where: { id: charge.id },
        data: { status: statusTransaction.toLowerCase() },
      });
    }

    if (isChargeback && charge.credited) {
      console.warn('[PIX] Chargeback recebido', { idTransaction, statusTransaction, requestNumber });
      await prisma.$transaction(async (tx) => {
        await tx.pixCharge.update({
          where: { id: charge.id },
          data: {
            status: 'chargeback',
            credited: false,
          },
        });

        await tx.user.update({
          where: { id: charge.userId },
          data: { balance: { decrement: charge.amount } },
        });

        await tx.transaction.create({
          data: {
            userId: charge.userId,
            type: 'debit',
            amount: -charge.amount,
            description: `Chargeback PIX (SuitPay #${idTransaction})`,
          },
        });
      });
      console.log(`[Webhook] Pix ${idTransaction} marcado como chargeback.`);
    }

    return res.status(200).json({ message: 'Recebido.' });
  } catch (error) {
    console.error('Erro Webhook:', error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};
