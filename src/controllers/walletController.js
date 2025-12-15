const { z } = require('zod');
const { recordTransaction } = require('../services/financeService');
const prisma = require('../prisma');
const SUPERVISOR_DEPOSIT_PCT = Number(process.env.SUPERVISOR_DEPOSIT_PCT || 5);
const SUPERVISOR_DEPOSIT_BASIS = 'deposit';

const amountSchema = z.preprocess(
  (val) => Number(val),
  z
    .number({
      required_error: 'Valor é obrigatório.',
      invalid_type_error: 'Valor inválido.',
    })
    .positive('O valor deve ser maior que zero.'),
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

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar saldo.' });
  }
};

exports.deposit = async (req, res) => {
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

      if (supervisorId && SUPERVISOR_DEPOSIT_PCT > 0) {
        const commissionAmount = Number(((value * SUPERVISOR_DEPOSIT_PCT) / 100).toFixed(2));
        if (commissionAmount > 0) {
          await tx.supervisorCommission.create({
            data: {
              supervisorId,
              userId: updated.id,
              amount: commissionAmount,
              basis: SUPERVISOR_DEPOSIT_BASIS,
              status: 'pending',
            },
          });
        }
      }

      return { ...updated, supervisorId };
    });

    return res.json({ message: 'Depósito simulado realizado.', balance: user.balance, bonus: user.bonus });
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
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, balance: true, cpf: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (!user.cpf) return res.status(400).json({ error: 'Cadastre o CPF na recarga Pix antes de solicitar saque.' });
    const storedCpf = (user.cpf || '').replace(/\D/g, '');
    if (storedCpf !== cpf) return res.status(400).json({ error: 'CPF divergente do cadastrado. Solicitação cancelada.' });
    if (Number(user.balance || 0) < value) return res.status(400).json({ error: 'Saldo insuficiente.' });

    const request = await prisma.withdrawalRequest.create({
      data: { userId: req.userId, amount: value, status: 'pending', pixKey: cpf, pixType: 'cpf' },
      select: { id: true, amount: true, status: true, createdAt: true, pixKey: true, pixType: true },
    });

    return res.status(201).json({ request });
  } catch (err) {
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
    return res.json({ withdrawals: requests });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar saques.' });
  }
};
