const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, balance: true, bonus: true },
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
  const { amount } = req.body;

  if (amount === undefined || Number.isNaN(Number(amount))) {
    return res.status(400).json({ error: 'Valor inválido.' });
  }

  const value = Number(amount);
  if (value <= 0) {
    return res.status(400).json({ error: 'O valor deve ser maior que zero.' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { balance: { increment: value } },
      select: { id: true, balance: true, bonus: true },
    });

    return res.json({ message: 'Depósito simulado realizado.', balance: user.balance, bonus: user.bonus });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar depósito.' });
  }
};
