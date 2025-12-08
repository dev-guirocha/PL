const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

const prisma = new PrismaClient();

async function recordTransaction({ userId, type, amount, description }) {
  try {
    await prisma.transaction.create({
      data: { userId, type, amount, description },
    });
  } catch (err) {
    // Registro de transação não deve quebrar o fluxo principal,
    // mas registramos no log para investigação futura.
    console.error('Erro ao registrar transação', err);
  }
}

const amountSchema = z.preprocess(
  (val) => Number(val),
  z
    .number({
      required_error: 'Valor é obrigatório.',
      invalid_type_error: 'Valor inválido.',
    })
    .positive('O valor deve ser maior que zero.'),
);

const apostaSchema = z
  .object({
    valorAposta: amountSchema,
    palpites: z.array(z.union([z.string(), z.number()])).default([]),
    modoValor: z.enum(['cada', 'todos']).optional(),
  })
  .passthrough();

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
  const parsed = amountSchema.safeParse(req.body.amount);
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Valor inválido.';
    return res.status(400).json({ error: message });
  }
  const value = parsed.data;

  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { balance: { increment: value } },
      select: { id: true, balance: true, bonus: true },
    });

    await recordTransaction({
      userId: req.userId,
      type: 'deposit',
      amount: value,
      description: 'Depósito na carteira',
    });

    return res.json({ message: 'Depósito simulado realizado.', balance: user.balance, bonus: user.bonus });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar depósito.' });
  }
};

function calculateBetTotal(aposta) {
  const valor = Number(aposta?.valorAposta);
  if (Number.isNaN(valor) || valor <= 0) {
    throw new Error('Valor da aposta inválido.');
  }
  const palpites = Array.isArray(aposta?.palpites) ? aposta.palpites : [];
  const qtd = palpites.length;
  const modo = aposta?.modoValor === 'cada' ? 'cada' : 'total';
  const total = modo === 'cada' ? valor * Math.max(qtd, 1) : valor;
  if (total <= 0) throw new Error('Total calculado inválido.');
  return total;
}

exports.debit = async (req, res) => {
  const debitSchema = z.object({
    apostas: z.array(apostaSchema).min(1, 'Envie ao menos uma aposta para debitar.'),
    loteria: z.string().optional(),
    codigoHorario: z.string().optional(),
  });

  const parsedBody = debitSchema.safeParse(req.body || {});
  if (!parsedBody.success) {
    const message = parsedBody.error.errors?.[0]?.message || 'Dados de aposta inválidos.';
    return res.status(400).json({ error: message });
  }
  const { apostas, loteria, codigoHorario } = parsedBody.data;

  let debited = 0;
  try {
    debited = apostas.reduce((acc, ap) => acc + calculateBetTotal(ap), 0);
  } catch (calcErr) {
    return res.status(400).json({ error: calcErr.message || 'Dados de aposta inválidos.' });
  }

  try {
    const updated = await prisma.user.updateMany({
      where: { id: req.userId, balance: { gte: debited } },
      data: { balance: { decrement: debited } },
    });

    if (updated.count === 0) {
      const userExists = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!userExists) return res.status(404).json({ error: 'Usuário não encontrado.' });
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { balance: true, bonus: true },
    });

    await recordTransaction({
      userId: req.userId,
      type: 'debit',
      amount: -debited,
      description: 'Débito de aposta',
    });

    let bet = null;
    try {
      bet = await prisma.bet.create({
        data: {
          userId: req.userId,
          loteria,
          codigoHorario,
          total: debited,
          dataJogo: apostas?.[0]?.data || null,
          modalidade: apostas?.[0]?.modalidade || null,
          colocacao: apostas?.[0]?.colocacao || null,
          palpites: JSON.stringify(apostas),
        },
        select: { id: true, total: true, createdAt: true },
      });
    } catch (e) {
      // Em caso de falha ao salvar a bet, ainda retornamos o débito para não gerar inconsistência de saldo
      console.error('Erro ao salvar bet', e);
    }

    return res.json({
      message: 'Débito realizado.',
      debited,
      balance: user.balance,
      bonus: user.bonus,
      bet,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao debitar.' });
  }
};
