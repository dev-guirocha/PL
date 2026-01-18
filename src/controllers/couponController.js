// src/controllers/couponController.js
// VERSÃO V36.1 - FINAL PRODUCTION (DECIMAL SAFE END-TO-END + ROI O(n) + MAP O(1))
// - STATS: 3 Queries + Merge em Memória usando Map (O(n)).
// - MATH: ROI/Margem com Prisma.Decimal (sem Number()).
// - CREATE: grava Decimal explicitamente (value/minDeposit).
// - VALIDATE: preview Decimal (sem drift vs webhook).

const prisma = require('../utils/prismaClient');
const { Prisma } = require('@prisma/client');
const { z } = require('zod');

// Constantes Decimal
const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
const COUPON_DEBUG = process.env.COUPON_DEBUG === 'true';

// Schema de Validação (entrada do Admin)
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value === 'number') return value;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
};

const createCouponSchema = z.object({
  code: z.string().trim().min(3).transform(v => v.toUpperCase()),
  description: z.string().optional().nullable(),
  type: z.enum(['fixed', 'percent', 'bonus']),
  value: z.preprocess(toNumber, z.number().positive()),
  minDeposit: z.preprocess(toNumber, z.number().min(0)).default(0),
  maxDeposit: z.preprocess(toNumber, z.number().min(0)).optional(),
  maxUses: z.preprocess(toNumber, z.number().int().positive()).default(1000),
  perUser: z.preprocess(toNumber, z.number().int().positive()).default(1),
  firstDepositOnly: z.boolean().optional().default(false),
  active: z.boolean().optional(),
  expiresAt: z.string().optional().nullable(), // ISO string
});

// --- ADMIN: ESTATÍSTICAS (ROI REAL) ---

exports.getCouponStats = async (req, res) => {
  try {
    // 1) Base do relatório
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, maxUses: true, active: true },
    });

    // 2) CUSTO (bônus pago) por couponId
    const costStats = await prisma.couponRedemption.groupBy({
      by: ['couponId'],
      _count: { _all: true },
      _sum: { amountApplied: true },
    });

    // 3) RECEITA (depósitos pagos) por couponCode snapshot
    const revenueStats = await prisma.pixCharge.groupBy({
      by: ['couponCode'],
      where: {
        status: 'PAID',
        couponCode: { not: null },
      },
      _sum: { amount: true },
    });

    // Lookup O(1)
    const costById = new Map(costStats.map(s => [s.couponId, s]));
    const revenueByCode = new Map(revenueStats.map(s => [s.couponCode, s]));

    const report = coupons.map(c => {
      const costData = costById.get(c.id);
      const revenueData = revenueByCode.get(c.code);

      const totalRedemptions = costData?._count?._all ?? 0;

      const costDecimal = costData?._sum?.amountApplied ?? ZERO;
      const revenueDecimal = revenueData?._sum?.amount ?? ZERO;

      const profitDecimal = revenueDecimal.sub(costDecimal);
      const marginDecimal = revenueDecimal.greaterThan(ZERO)
        ? profitDecimal.div(revenueDecimal).mul(HUNDRED)
        : ZERO;

      const usagePercent =
        c.maxUses > 0 ? ((totalRedemptions / c.maxUses) * 100).toFixed(1) + '%' : 'N/A';

      return {
        id: c.id,
        code: c.code,
        active: c.active,
        usage: `${totalRedemptions} / ${c.maxUses}`,
        usagePercent,
        financials: {
          revenue: revenueDecimal.toFixed(2),
          cost: costDecimal.toFixed(2),
          profit: profitDecimal.toFixed(2),
          marginPercent: marginDecimal.toFixed(2),
        },
      };
    });

    return res.json({ report });
  } catch (error) {
    console.error('Erro Stats:', error);
    return res.status(500).json({ error: 'Erro ao gerar estatísticas.' });
  }
};

// --- USER: VALIDAÇÃO (PREVIEW) ---

exports.validateCoupon = async (req, res) => {
  const { code, amount } = req.body;
  const userId = req.userId;

  if (COUPON_DEBUG) {
    console.log('[COUPON_VALIDATE]', { userId, code, amount });
  }

  if (!code) {
    if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] missing_code');
    return res.status(400).json({ error: 'Código obrigatório.' });
  }

  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code: String(code).toUpperCase().trim() },
    });

    if (!coupon) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] invalid_code');
      return res.status(404).json({ error: 'Cupom inválido.' });
    }
    if (!coupon.active) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] inactive');
      return res.status(400).json({ error: 'Cupom inativo.' });
    }

    const now = new Date();
    if (coupon.expiresAt && now > coupon.expiresAt) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] expired');
      return res.status(400).json({ error: 'Cupom expirado.' });
    }

    if (coupon.usedCount >= coupon.maxUses) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] max_uses');
      return res.status(400).json({ error: 'Cupom esgotado.' });
    }

    // Limite por usuário
    const userUsage = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });

    if (userUsage >= coupon.perUser) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] per_user_limit');
      return res
        .status(400)
        .json({ error: 'Você já usou este cupom o máximo de vezes permitido.' });
    }

    // Primeiro depósito apenas: bloqueia se já existe Pix pago
    if (coupon.firstDepositOnly) {
      const priorPaid = await prisma.pixCharge.count({
        where: { userId, status: { in: ['PAID', 'paid'] } },
      });
      if (priorPaid > 0) {
        if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] first_deposit_only');
        return res.status(400).json({ error: 'Cupom válido apenas para o primeiro depósito.' });
      }
    }

    const amountProvided = amount !== undefined && amount !== null && String(amount).trim() !== '';
    if (!amountProvided) {
      return res.json({
        valid: true,
        code: coupon.code,
        bonusPreview: null,
        message: 'Cupom válido. Informe um valor para calcular o bônus.',
      });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] invalid_amount');
      return res.status(400).json({ error: 'Valor inválido.' });
    }

    const depositValue = new Prisma.Decimal(amountNum.toFixed(2));

    if (!depositValue.greaterThanOrEqualTo(coupon.minDeposit)) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] below_min_deposit');
      return res.status(400).json({
        error: `Depósito mínimo: R$ ${coupon.minDeposit.toFixed(2)}`,
      });
    }
    if (coupon.maxDeposit && depositValue.greaterThan(coupon.maxDeposit)) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] above_max_deposit');
      return res.status(400).json({
        error: `Depósito máximo: R$ ${coupon.maxDeposit.toFixed(2)}`,
      });
    }
    if (coupon.type === 'percent' && Number(coupon.value) === 20 && depositValue.greaterThan(new Prisma.Decimal(1000))) {
      if (COUPON_DEBUG) console.warn('[COUPON_VALIDATE_FAIL] max_20pct');
      return res.status(400).json({ error: 'Para este cupom, o depósito máximo é R$ 1.000,00.' });
    }

    // Preview Decimal-safe
    let bonusPreview = ZERO;
    if (coupon.type === 'percent') {
      bonusPreview = depositValue.mul(coupon.value).div(HUNDRED);
    } else {
      bonusPreview = coupon.value;
    }

    return res.json({
      valid: true,
      code: coupon.code,
      bonusPreview: bonusPreview.toFixed(2),
      message: `Cupom válido! Bônus estimado: R$ ${bonusPreview.toFixed(2)}`,
    });
  } catch (error) {
    if (COUPON_DEBUG) console.error('[COUPON_VALIDATE_ERROR]', error);
    console.error('Erro validateCoupon:', error);
    return res.status(500).json({ error: 'Erro ao validar cupom.' });
  }
};

// --- ADMIN: LISTAR / CRIAR / ATIVAR / DELETAR ---

exports.listCoupons = async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ coupons });
  } catch (error) {
    console.error('Erro listCoupons:', error);
    return res.status(500).json({ error: 'Erro ao listar cupons.' });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const data = createCouponSchema.parse(req.body);

    const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (existing) return res.status(400).json({ error: 'Código já existe.' });

    const coupon = await prisma.coupon.create({
      data: {
        code: data.code,
        description: data.description || null,
        type: data.type,
        value: new Prisma.Decimal(String(data.value)), // ✅ Decimal explícito
        minDeposit: new Prisma.Decimal(String(data.minDeposit)), // ✅ Decimal explícito
        maxDeposit: data.maxDeposit !== undefined ? new Prisma.Decimal(String(data.maxDeposit)) : null,
        maxUses: data.maxUses,
        perUser: data.perUser,
        firstDepositOnly: data.firstDepositOnly,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        active: data.active ?? true,
      },
    });

    return res.status(201).json(coupon);
  } catch (error) {
    if (COUPON_DEBUG) {
      console.error('[COUPON_CREATE_ERROR]', {
        message: error?.message,
        zod: error?.errors,
        body: req.body,
      });
    }
    return res.status(400).json({
      error: error?.errors?.[0]?.message || 'Erro ao criar.',
    });
  }
};

exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.coupon.findUnique({ where: { id: Number(id) } });
    if (!coupon) return res.status(404).json({ error: 'Cupom não encontrado.' });

    const updated = await prisma.coupon.update({
      where: { id: Number(id) },
      data: { active: !coupon.active },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Erro toggleActive:', error);
    return res.status(500).json({ error: 'Erro ao alterar status.' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await prisma.coupon.delete({ where: { id: Number(req.params.id) } });
    return res.json({ message: 'Cupom removido.' });
  } catch (error) {
    console.error('Erro deleteCoupon:', error);
    return res.status(500).json({ error: 'Erro ao deletar.' });
  }
};
