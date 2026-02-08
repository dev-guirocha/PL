const { z } = require('zod');
const { recordTransaction } = require('../services/financeService');
const prisma = require('../prisma');
const {
  ZERO,
  DECIMAL_REGEX,
  normalizeDecimalString,
  toMoney,
  formatMoney,
  calculateCommission,
  toDecimalSafe,
} = require('../utils/money');
const SUPERVISOR_DEPOSIT_PCT = normalizeDecimalString(process.env.SUPERVISOR_DEPOSIT_PCT || '5');
const SUPERVISOR_DEPOSIT_BASIS = 'deposit';
const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');

const amountSchema = z.preprocess(
  (val) => normalizeDecimalString(val),
  z
    .string({
      required_error: 'Valor é obrigatório.',
      invalid_type_error: 'Valor inválido.',
    })
    .refine((val) => val && DECIMAL_REGEX.test(val), 'Valor inválido.')
    .transform((val) => toMoney(val))
    .refine((val) => val.greaterThan(ZERO), 'O valor deve ser maior que zero.'),
);

const cpfSchema = z.preprocess(
  (val) => (val || '').toString().replace(/\D/g, ''),
  z
    .string({
      required_error: 'CPF é obrigatório.',
      invalid_type_error: 'CPF inválido.',
    })
    .length(11, 'CPF deve conter 11 dígitos.'),
);

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        isAdmin: true,
        balance: true,
        bonus: true,
        supervisorId: true,
        pendingSupCode: true,
        cpf: true,
        phone: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Corrige saldos negativos que possam ter ficado por inconsistência
    if (toMoney(user.balance).lessThan(ZERO)) {
      const fixed = await prisma.user.update({
        where: { id: req.userId },
        data: { balance: ZERO },
        select: {
          id: true,
          name: true,
          isAdmin: true,
          balance: true,
          bonus: true,
          supervisorId: true,
          pendingSupCode: true,
          cpf: true,
          phone: true,
        },
      });
      return res.json({
        ...fixed,
        balance: formatMoney(fixed.balance),
        bonus: formatMoney(fixed.bonus),
      });
    }

    return res.json({
      ...user,
      balance: formatMoney(user.balance),
      bonus: formatMoney(user.bonus),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar saldo.' });
  }
};

exports.deposit = async (req, res) => {
  const allowManualDeposit = process.env.ALLOW_MANUAL_DEPOSIT === 'true';
  if (process.env.NODE_ENV === 'production' && !allowManualDeposit && !req.isAdmin) {
    return res.status(403).json({ error: 'Depósito manual desabilitado em produção.' });
  }

  const parsed = amountSchema.safeParse(req.body.amount);
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Valor inválido.';
    return res.status(400).json({ error: message });
  }
  const value = parsed.data;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.userId },
        data: { balance: { increment: value } },
        select: { id: true, balance: true, bonus: true, supervisorId: true, pendingSupCode: true },
      });

      await recordTransaction({
        userId: req.userId,
        type: 'deposit',
        amount: value,
        description: 'Depósito na carteira',
        client: tx,
        suppressErrors: false,
      });

      let supervisorId = updated.supervisorId;

      // Vincula supervisor somente após primeiro depósito
      if (!supervisorId && updated.pendingSupCode) {
        const sup = await tx.supervisor.findUnique({ where: { code: updated.pendingSupCode } });
        if (sup) {
          await tx.user.update({
            where: { id: updated.id },
            data: { supervisorId: sup.id, pendingSupCode: null },
          });
          supervisorId = sup.id;
        }
      }

      if (supervisorId) {
        const supervisor = await tx.supervisor.findUnique({
          where: { id: supervisorId },
          select: { id: true, user: { select: { isBlocked: true, deletedAt: true } } },
        });
        const supervisorBlocked = Boolean(supervisor?.user?.isBlocked || supervisor?.user?.deletedAt);
        if (!supervisorBlocked) {
          const commissionAmount = calculateCommission(value, SUPERVISOR_DEPOSIT_PCT);
          if (commissionAmount.greaterThan(ZERO)) {
            await tx.supervisorCommission.create({
              data: {
                supervisorId,
                userId: updated.id,
                amount: commissionAmount,
                commissionRate: toDecimalSafe(SUPERVISOR_DEPOSIT_PCT).toDecimalPlaces(2),
                basis: SUPERVISOR_DEPOSIT_BASIS,
                status: 'pending',
              },
            });
          }
        }
      }

      return { ...updated, supervisorId };
    });

    return res.json({
      message: 'Depósito simulado realizado.',
      balance: formatMoney(user.balance),
      bonus: formatMoney(user.bonus),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar depósito.' });
  }
};

exports.requestWithdrawal = async (req, res) => {
  const parsedAmount = amountSchema.safeParse(req.body.amount);
  const parsedCpf = cpfSchema.safeParse(req.body.cpf);

  if (!parsedAmount.success) {
    const message = parsedAmount.error.errors?.[0]?.message || 'Valor inválido.';
    return res.status(400).json({ error: message });
  }
  if (!parsedCpf.success) {
    const message = parsedCpf.error.errors?.[0]?.message || 'CPF inválido.';
    return res.status(400).json({ error: message });
  }

  const value = parsedAmount.data;
  const cpf = parsedCpf.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: req.userId },
        select: { id: true, balance: true, cpf: true },
      });
      if (!user) {
        const err = new Error('Usuário não encontrado.');
        err.code = 'ERR_NO_USER';
        throw err;
      }
      if (!user.cpf) {
        const err = new Error('Cadastre o CPF na recarga Pix antes de solicitar saque.');
        err.code = 'ERR_NO_CPF';
        throw err;
      }
      const storedCpf = (user.cpf || '').replace(/\D/g, '');
      if (storedCpf !== cpf) {
        const err = new Error('CPF divergente do cadastrado. Solicitação cancelada.');
        err.code = 'ERR_CPF_MISMATCH';
        throw err;
      }

      const updated = await tx.user.updateMany({
        where: { id: req.userId, balance: { gte: value } },
        data: { balance: { decrement: value } },
      });

      if (!updated.count) {
        const err = new Error('Saldo insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }

      const request = await tx.withdrawalRequest.create({
        data: { userId: req.userId, amount: value, status: 'pending', pixKey: cpf, pixType: 'cpf' },
        select: { id: true, amount: true, status: true, createdAt: true, pixKey: true, pixType: true },
      });

      await recordTransaction({
        userId: req.userId,
        type: 'withdraw_request',
        amount: value.negated(),
        description: `Solicitação de saque ${request.id}`,
        client: tx,
        suppressErrors: false,
      });

      return { request };
    });

    return res.status(201).json({
      request: {
        ...result.request,
        amount: formatMoney(result.request.amount),
      },
    });
  } catch (err) {
    if (err?.code === 'ERR_NO_USER') return res.status(404).json({ error: err.message });
    if (err?.code === 'ERR_NO_CPF' || err?.code === 'ERR_CPF_MISMATCH') {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === 'ERR_NO_BALANCE') return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Erro ao solicitar saque.' });
  }
};

exports.listMyWithdrawals = async (req, res) => {
  try {
    const requests = await prisma.withdrawalRequest.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, amount: true, status: true, createdAt: true, pixKey: true, pixType: true },
    });
    return res.json({
      withdrawals: requests.map((req) => ({
        ...req,
        amount: formatMoney(req.amount),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar saques.' });
  }
};

exports.listStatement = async (req, res) => {
  try {
    const takeRaw = Number(req.query.take) || 50;
    const skipRaw = Number(req.query.skip) || 0;
    const take = Math.min(Math.max(Math.floor(takeRaw), 1), 100);
    const skip = Math.max(Math.floor(skipRaw), 0);
    const category = String(req.query.category || 'all')
      .trim()
      .toLowerCase();

    const categoryMap = {
      deposit: ['deposit'],
      bet: ['bet'],
      prize: ['prize'],
      withdraw: ['withdraw_request'],
    };
    const acceptedTypes = categoryMap[category] || null;

    const where = { userId: req.userId };
    if (acceptedTypes) {
      where.type = { in: acceptedTypes };
    }

    const [items, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: { id: true, type: true, amount: true, description: true, createdAt: true },
      }),
      prisma.transaction.count({ where }),
    ]);

    const hasMore = skip + items.length < total;
    return res.json({
      items: items.map((item) => ({
        ...item,
        amount: formatMoney(item.amount),
      })),
      total,
      hasMore,
      take,
      skip,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar extrato.' });
  }
};

const sumAmounts = (rows) =>
  rows.reduce((acc, row) => acc.add(row.amount || ZERO), ZERO);

exports.requestSupervisorWithdrawal = async (req, res) => {
  const supervisor = req.supervisor;
  if (!supervisor) return res.status(403).json({ error: 'Acesso restrito a supervisores.' });

  const parsedAmount = amountSchema.safeParse(req.body.amount);
  const parsedCpf = cpfSchema.safeParse(req.body.cpf);

  if (!parsedAmount.success) {
    const message = parsedAmount.error.errors?.[0]?.message || 'Valor inválido.';
    return res.status(400).json({ error: message });
  }
  if (!parsedCpf.success) {
    const message = parsedCpf.error.errors?.[0]?.message || 'CPF inválido.';
    return res.status(400).json({ error: message });
  }

  const value = parsedAmount.data;
  const cpf = parsedCpf.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!isSqlite) {
        await tx.$queryRaw`SELECT id FROM "Supervisor" WHERE id = ${supervisor.id} FOR UPDATE`;
      }

      const pendingRequests = await tx.supervisorWithdrawalRequest.findMany({
        where: { supervisorId: supervisor.id, status: 'pending' },
        select: { id: true, amount: true },
      });
      if (pendingRequests.length) {
        const err = new Error('Existe um saque pendente. Aguarde a aprovacao.');
        err.code = 'ERR_PENDING_WITHDRAWAL';
        throw err;
      }

      const commissions = await tx.supervisorCommission.findMany({
        where: { supervisorId: supervisor.id, status: 'pending', payoutRequestId: null },
        select: { id: true, amount: true },
        orderBy: { createdAt: 'asc' },
      });

      const totalAvailable = sumAmounts(commissions);
      if (!totalAvailable.greaterThan(ZERO)) {
        const err = new Error('Saldo de comissao insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }
      if (value.greaterThan(totalAvailable)) {
        const err = new Error('Saldo de comissao insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }

      const reserved = [];
      let reservedTotal = ZERO;
      for (const commission of commissions) {
        if (reservedTotal.greaterThanOrEqualTo(value)) break;
        reserved.push(commission.id);
        reservedTotal = reservedTotal.add(commission.amount || ZERO);
      }

      const request = await tx.supervisorWithdrawalRequest.create({
        data: {
          supervisorId: supervisor.id,
          amount: value,
          status: 'pending',
          pixKey: cpf,
          pixType: 'cpf',
        },
        select: { id: true, amount: true, status: true, createdAt: true, pixKey: true, pixType: true },
      });

      if (reserved.length) {
        const updated = await tx.supervisorCommission.updateMany({
          where: { id: { in: reserved }, status: 'pending', payoutRequestId: null },
          data: { status: 'reserved', payoutRequestId: request.id },
        });
        if (updated.count !== reserved.length) {
          const err = new Error('Comissoes ja reservadas.');
          err.code = 'ERR_RACE';
          throw err;
        }
      }

      return { request, reservedTotal };
    });

    return res.status(201).json({
      request: {
        ...result.request,
        amount: formatMoney(result.request.amount),
      },
      reservedAmount: formatMoney(result.reservedTotal || 0),
    });
  } catch (err) {
    if (err?.code === 'ERR_RACE') return res.status(409).json({ error: err.message });
    if (err?.code === 'ERR_PENDING_WITHDRAWAL') return res.status(409).json({ error: err.message });
    if (err?.code === 'ERR_NO_BALANCE') return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Erro ao solicitar saque do supervisor.' });
  }
};

exports.listSupervisorWithdrawals = async (req, res) => {
  const supervisor = req.supervisor;
  if (!supervisor) return res.status(403).json({ error: 'Acesso restrito a supervisores.' });

  try {
    const [requests, pendingCommissions] = await prisma.$transaction([
      prisma.supervisorWithdrawalRequest.findMany({
        where: { supervisorId: supervisor.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, amount: true, status: true, createdAt: true, pixKey: true, pixType: true },
      }),
      prisma.supervisorCommission.aggregate({
        where: { supervisorId: supervisor.id, status: 'pending' },
        _sum: { amount: true },
      }),
    ]);

    return res.json({
      available: formatMoney(pendingCommissions._sum.amount || 0),
      withdrawals: requests.map((req) => ({
        ...req,
        amount: formatMoney(req.amount),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar saques do supervisor.' });
  }
};
