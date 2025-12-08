const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { betRequestSchema, placeBet, ERR_NO_BALANCE, ERR_NO_USER, ERR_CUTOFF_PASSED } = require('../services/betService');

const prisma = new PrismaClient();

const intFromAny = (fallback) =>
  z.preprocess(
    (val) => {
      const num = Number(val);
      if (Number.isNaN(num)) return fallback;
      return Math.max(1, Math.floor(num));
    },
    z.number().int().positive(),
  );

exports.create = async (req, res) => {
  const parsed = betRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Dados de aposta inválidos.';
    return res.status(400).json({ error: message });
  }

  try {
    const result = await placeBet({
      prismaClient: prisma,
      userId: req.userId,
      ...parsed.data,
    });

    return res.status(201).json({
      bet: result.bet,
      balance: result.user.balance,
      bonus: result.user.bonus,
      debited: result.debited,
    });
  } catch (err) {
    if (err?.code === 'ERR_INVALID_BET') {
      return res.status(400).json({ error: err.message || 'Dados de aposta inválidos.' });
    }
    if (err?.code === ERR_NO_BALANCE || err?.message === ERR_NO_BALANCE) {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    if (err?.code === ERR_NO_USER || err?.message === ERR_NO_USER) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    if (err?.code === ERR_CUTOFF_PASSED) {
      return res.status(400).json({ error: err.message || 'Horário encerrado para este sorteio.' });
    }
    return res.status(500).json({ error: 'Erro ao salvar aposta.' });
  }
};

exports.list = async (req, res) => {
  const querySchema = z.object({
    page: intFromAny(1).optional(),
    pageSize: intFromAny(10).optional(),
  });

  const parsed = querySchema.safeParse(req.query || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros de paginação inválidos.' });
  }

  const page = parsed.data.page || 1;
  const rawPageSize = parsed.data.pageSize || 10;
  const pageSize = Math.min(rawPageSize, 50); // evita consultas muito grandes
  const skip = (page - 1) * pageSize;

  try {
    const [bets, total] = await prisma.$transaction([
      prisma.bet.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          loteria: true,
          codigoHorario: true,
          total: true,
          createdAt: true,
          dataJogo: true,
          modalidade: true,
          colocacao: true,
          palpites: true,
        },
      }),
      prisma.bet.count({ where: { userId: req.userId } }),
    ]);

    const serialize = (bet) => {
      let apostas = [];
      try {
        apostas = typeof bet.palpites === 'string' ? JSON.parse(bet.palpites) : bet.palpites || [];
      } catch {
        apostas = [];
      }
      return {
        id: bet.id,
        loteria: bet.loteria,
        codigoHorario: bet.codigoHorario,
        total: bet.total,
        createdAt: bet.createdAt,
        dataJogo: bet.dataJogo,
        modalidade: bet.modalidade,
        colocacao: bet.colocacao,
        apostas,
      };
    };

    const hasMore = skip + bets.length < total;

    return res.json({ bets: bets.map(serialize), page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar apostas.' });
  }
};
