const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { recordTransaction } = require('../services/financeService');

const prisma = new PrismaClient();

const amountSchema = z.preprocess(
  (val) => Number(val),
  z
    .number({
      required_error: 'Valor é obrigatório.',
      invalid_type_error: 'Valor inválido.',
    })
    .positive('O valor deve ser maior que zero.'),
);

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, balance: true, bonus: true, supervisorId: true, pendingSupCode: true },
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

      // Vincula supervisor somente após primeiro depósito
      if (!updated.supervisorId && updated.pendingSupCode) {
        const sup = await tx.supervisor.findUnique({ where: { code: updated.pendingSupCode } });
        if (sup) {
          await tx.user.update({
            where: { id: updated.id },
            data: { supervisorId: sup.id, pendingSupCode: null },
          });
        }
      }

      return updated;
    });

    return res.json({ message: 'Depósito simulado realizado.', balance: user.balance, bonus: user.bonus });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar depósito.' });
  }
};
