// src/controllers/pixController.js
// VERSÃO V35.1 - FINAL PRODUCTION (UUID + STATUS UPPERCASE + COUPON SNAPSHOT + DECIMAL SAFE)
// - ID: crypto.randomUUID() (collision free)
// - STATUS: 'PENDING' (padronizado)
// - DECIMAL: tudo que é dinheiro vira Prisma.Decimal (sem drift)
// - COUPON: valida hard-fail antes de chamar Woovi/OpenPix e salva snapshot couponCode no PixCharge
// - FALLBACK: bônus padrão (15%) só quando NÃO informou cupom

const prisma = require('../utils/prismaClient');
const woovi = require('../lib/wooviClient');
const { Prisma } = require('@prisma/client');
const crypto = require('crypto');

const HUNDRED = new Prisma.Decimal(100);
const ZERO = new Prisma.Decimal(0);
const FALLBACK_RATE = new Prisma.Decimal('0.15'); // 15%
const FALLBACK_RATE_PROMO = new Prisma.Decimal('0.20'); // 20% (promo do fim de semana)
const PROMO_START_DATE = '2026-01-31';
const PROMO_END_DATE = '2026-02-01';
const ONE_DAY_MAX_DEPOSIT_DATE = '2026-02-06';
const ONE_DAY_MAX_DEPOSIT = 10000;
const ONE_DAY_BONUS_CAP = new Prisma.Decimal('10000');
const PIX_DEBUG = process.env.PIX_DEBUG === 'true';

const getTodayStr = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const isPromoActive = () => {
  const today = getTodayStr();
  return today >= PROMO_START_DATE && today <= PROMO_END_DATE;
};

const isOneDayMaxDepositActive = () => getTodayStr() === ONE_DAY_MAX_DEPOSIT_DATE;

const getFallbackRate = () => (isPromoActive() ? FALLBACK_RATE_PROMO : FALLBACK_RATE);
const getDepositMax = () => (isOneDayMaxDepositActive() ? ONE_DAY_MAX_DEPOSIT : 1500);

exports.createPixCharge = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      console.warn('⚠️ Tentativa de criar Pix sem usuário autenticado.');
      return res.status(401).json({ error: 'Usuário não identificado.' });
    }

    const { amount, cpf, nome, email, couponCode } = req.body;

    // --- Validações básicas ---
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    const valueNumber = Number(amount);

    if (!cleanCpf || cleanCpf.length !== 11) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    if (!Number.isFinite(valueNumber) || valueNumber < 10) {
      return res.status(400).json({ error: 'Depósito mínimo é R$ 10,00.' });
    }
    const depositMax = getDepositMax();
    if (valueNumber > depositMax) {
      const formatted = depositMax.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return res.status(400).json({ error: `Depósito máximo é R$ ${formatted}.` });
    }

    // Decimal seguro (2 casas)
    const depositValue = new Prisma.Decimal(valueNumber.toFixed(2));

    // --- Cupom: valida hard fail + preview (informativo) ---
    const userProvidedCoupon = Boolean(couponCode && String(couponCode).trim());
    const couponSnapshot = userProvidedCoupon ? String(couponCode).trim().toUpperCase() : null;

    let bonusPreview = null; // Prisma.Decimal | null

    if (couponSnapshot) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponSnapshot } });

      if (!coupon) return res.status(404).json({ error: 'Cupom inválido.' });
      if (!coupon.active) return res.status(400).json({ error: 'Cupom inativo.' });

      const now = new Date();
      if (coupon.expiresAt && coupon.expiresAt < now) {
        return res.status(400).json({ error: 'Cupom expirado.' });
      }

      // Pré-check (não é atômico; o atômico é no webhook)
      if (coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ error: 'Cupom esgotado.' });
      }

      if (!depositValue.greaterThanOrEqualTo(coupon.minDeposit)) {
        return res.status(400).json({
          error: `Depósito mínimo para este cupom é R$ ${coupon.minDeposit.toFixed(2)}.`,
        });
      }
      if (coupon.maxDeposit && depositValue.greaterThan(coupon.maxDeposit)) {
        return res.status(400).json({
          error: `Depósito máximo para este cupom é R$ ${coupon.maxDeposit.toFixed(2)}.`,
        });
      }

      const userUses = await prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId: Number(userId) },
      });

      if (userUses >= coupon.perUser) {
        return res.status(400).json({ error: 'Você já atingiu o limite de uso deste cupom.' });
      }

      if (coupon.firstDepositOnly) {
        const priorPaid = await prisma.pixCharge.count({
          where: { userId: Number(userId), status: { in: ['PAID', 'paid'] } },
        });
        if (priorPaid > 0) {
          return res.status(400).json({ error: 'Cupom válido apenas para o primeiro depósito.' });
        }
      }

      // Preview (aplicação real só no webhook)
      if (coupon.type === 'percent') {
        bonusPreview = depositValue.mul(coupon.value).div(HUNDRED);
      } else {
        bonusPreview = coupon.value;
      }

      if (coupon.type === 'percent' && Number(coupon.value) === 20 && depositValue.greaterThan(new Prisma.Decimal(1000))) {
        return res.status(400).json({ error: 'Para este cupom, o depósito máximo é R$ 1.000,00.' });
      }

      if (!bonusPreview || !bonusPreview.greaterThan(ZERO)) {
        return res.status(400).json({ error: 'Cupom não gera bônus para este valor.' });
      }
    }

    // --- Integração Woovi/OpenPix ---
    const valueInCents = Math.round(valueNumber * 100);
    const correlationID = `pix-${crypto.randomUUID()}`;

    if (PIX_DEBUG) {
      console.log('🚀 [OpenPix/Woovi] Criando cobrança:', correlationID, valueInCents);
    }

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

    // Parse tolerante (Woovi pode variar)
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

    // Fallback (somente se NÃO informou cupom)
    const bonusBase = isOneDayMaxDepositActive() && depositValue.greaterThan(ONE_DAY_BONUS_CAP)
      ? ONE_DAY_BONUS_CAP
      : depositValue;
    const bonusAmount = couponSnapshot ? null : bonusBase.mul(getFallbackRate());

    // --- Persistência: correlationId para lookup no webhook ---
    await prisma.pixCharge.create({
      data: {
        correlationId: correlationID,
        userId: Number(userId),
        amount: depositValue,
        bonusAmount: bonusAmount || undefined,
        status: 'PENDING',
        txid: txid || correlationID,
        copyAndPaste: brCode,
        qrCodeImage: qrCodeImage,
        couponCode: couponSnapshot,
      },
    });

    return res.json({
      success: true,
      correlationID,
      brCode,
      qrCodeImage,
      paymentLinkUrl,
      identifier,
      couponApplied: !!couponSnapshot,

      // UI-friendly
      bonusPreview: bonusPreview ? bonusPreview.toFixed(2) : null,
      bonusAmount: bonusAmount ? bonusAmount.toFixed(2) : null,
    });
  } catch (err) {
    console.error('❌ Axios/Woovi message:', err.message);
    console.error('❌ Status:', err.response?.status);
    console.error('❌ Data:', err.response?.data);

    const status = err.response?.status || 500;

    return res.status(status).json({
      error: 'Erro ao gerar Pix',
      status,
      message: err.message,
    });
  }
};
