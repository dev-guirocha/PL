const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { recordTransaction } = require('../services/financeService');

const prisma = new PrismaClient();
const SUPERVISOR_COMMISSION_PCT = Number(process.env.SUPERVISOR_COMMISSION_PCT || 0);
const SUPERVISOR_COMMISSION_BASIS = process.env.SUPERVISOR_COMMISSION_BASIS || 'stake';

const betPayloadSchema = z.object({
  loteria: z.string().min(1, 'Loteria é obrigatória'),
  codigoHorario: z.string().min(1, 'Horário é obrigatório'),
  apostas: z
    .array(
      z.object({
        jogo: z.string().optional(),
        data: z.string().optional(), // YYYY-MM-DD
        modalidade: z.string(),
        colocacao: z.string(),
        palpites: z.array(z.union([z.string(), z.number()])).min(1, 'Palpites obrigatórios'),
        modoValor: z.enum(['cada', 'todos']).optional(),
        valorAposta: z
          .preprocess((val) => Number(val), z.number().positive('Valor da aposta deve ser positivo.')),
      }),
    )
    .min(1, 'Envie ao menos uma aposta.'),
});

// Calcula o valor total de forma confiável no backend
function calculateTotal(apostas) {
  return apostas.reduce((acc, ap) => {
    const valor = Number(ap.valorAposta);
    const qtd = ap.palpites.length;
    const subtotal = ap.modoValor === 'cada' ? valor * qtd : valor;
    return acc + subtotal;
  }, 0);
}

// Limites de horário conhecidos (HH:MM)
const normalizeHorarioKey = (codigo) => (codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const horariosLimite = {
  PTRJ14HS: '14:05',
  PTSP16HS: '16:05',
  PTRJ18HS: '18:05',
  PTRJ21HS: '21:05',
};
const DEFAULT_CUTOFF_GRACE_MIN = 5;

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [hStr, mStr] = timeStr.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr || 0);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

// Extrai a hora de um texto como "LT PT RIO 14HS" e retorna em minutos do dia
const resolveHorarioMinutes = ({ codigoHorario, graceMinutes = 0 }) => {
  if (!codigoHorario) return null;
  const match = codigoHorario.match(/(\d{1,2})\s*hs/i);
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour * 60 + graceMinutes;
};

const isBettingAllowed = (codigoHorario, data) => {
  const normalizedKey = normalizeHorarioKey(codigoHorario);
  const mapped = horariosLimite[normalizedKey];
  const cutoffMinutesMap = parseTimeToMinutes(mapped);
  const cutoffMinutesPattern = resolveHorarioMinutes({ codigoHorario, graceMinutes: DEFAULT_CUTOFF_GRACE_MIN });
  const cutoffMinutes = cutoffMinutesMap ?? cutoffMinutesPattern;
  if (cutoffMinutes === null) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes < cutoffMinutes;
};

const serializeBet = (bet) => {
  let apostas = [];
  try {
    apostas = typeof bet.palpites === 'string' ? JSON.parse(bet.palpites) : bet.palpites || [];
  } catch {
    apostas = [];
  }
  const betRef = bet.userId ? `${bet.userId}-${bet.id}` : undefined;
  return {
    id: bet.id,
    userId: bet.userId,
    loteria: bet.loteria,
    codigoHorario: bet.codigoHorario,
    total: bet.total,
    createdAt: bet.createdAt,
    dataJogo: bet.dataJogo,
    modalidade: bet.modalidade,
    colocacao: bet.colocacao,
    apostas,
    betRef,
  };
};

const intFromAny = (fallback) =>
  z.preprocess(
    (val) => {
      const num = Number(val);
      if (Number.isNaN(num)) return fallback;
      return Math.max(1, Math.floor(num));
    },
    z.number().int().positive(),
  );

const nonNegativeFromAny = (fallback) =>
  z.preprocess(
    (val) => {
      const num = Number(val);
      if (Number.isNaN(num)) return fallback;
      return Math.max(0, Math.floor(num));
    },
    z.number().int().nonnegative(),
  );

const paginationSchema = z.object({
  page: intFromAny(1).optional(),
  pageSize: intFromAny(10).optional(),
  take: intFromAny(10).optional(),
  skip: nonNegativeFromAny(0).optional(),
});

const normalizePagination = (data) => {
  const rawTake = data.take ?? data.pageSize ?? 10;
  const take = Math.min(rawTake, 50);
  const rawSkip = data.skip ?? ((data.page ?? 1) - 1) * take;
  const skip = Math.max(rawSkip, 0);
  return { take, skip };
};

exports.create = async (req, res) => {
  const parsed = betPayloadSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const message = parsed.error.errors?.[0]?.message || 'Dados de aposta inválidos.';
    return res.status(400).json({ error: message });
  }

  const { loteria, codigoHorario, apostas } = parsed.data;
  const totalDebit = calculateTotal(apostas);
  const betDate = apostas?.[0]?.data;

  if (!isBettingAllowed(codigoHorario, betDate)) {
    return res.status(400).json({ error: 'Horário encerrado para este sorteio.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: req.userId, balance: { gte: totalDebit } },
        data: { balance: { decrement: totalDebit } },
      });

      if (updated.count === 0) {
        const userExists = await tx.user.findUnique({ where: { id: req.userId }, select: { id: true } });
        if (!userExists) {
          const err = new Error('Usuário não encontrado.');
          err.code = 'ERR_NO_USER';
          throw err;
        }
        const err = new Error('Saldo insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }

      const bet = await tx.bet.create({
        data: {
          userId: req.userId,
          loteria,
          codigoHorario,
          dataJogo: betDate,
          modalidade: apostas.length === 1 ? apostas[0].modalidade : 'MULTIPLAS',
          colocacao: apostas.length === 1 ? apostas[0].colocacao : 'VARIADAS',
          total: totalDebit,
          palpites: JSON.stringify(apostas),
          status: 'open',
        },
      });

      const user = await tx.user.findUnique({
        where: { id: req.userId },
        select: { balance: true, bonus: true, supervisorId: true },
      });

      await recordTransaction({
        userId: req.userId,
        type: 'bet',
        amount: -totalDebit,
        description: `Aposta ${bet.id} - ${loteria}`,
        client: tx,
        suppressErrors: false,
      });

      if (user?.supervisorId && SUPERVISOR_COMMISSION_PCT > 0) {
        const commissionAmount = Number(((totalDebit * SUPERVISOR_COMMISSION_PCT) / 100).toFixed(2));
        if (commissionAmount > 0) {
          await tx.supervisorCommission.create({
            data: {
              supervisorId: user.supervisorId,
              userId: req.userId,
              betId: bet.id,
              amount: commissionAmount,
              basis: SUPERVISOR_COMMISSION_BASIS,
              status: 'pending',
            },
          });
        }
      }

      return { bet, user };
    });

    const betRef = `${req.userId}-${result.bet.id}`;

    return res.status(201).json({
      message: 'Aposta realizada com sucesso!',
      bet: { ...result.bet, betRef },
      balance: result.user?.balance,
      bonus: result.user?.bonus,
      debited: totalDebit,
    });
  } catch (err) {
    if (err?.code === 'ERR_NO_BALANCE' || err?.message === 'ERR_NO_BALANCE' || err?.message === 'Saldo insuficiente.') {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    if (err?.code === 'ERR_NO_USER' || err?.message === 'ERR_NO_USER' || err?.message === 'Usuário não encontrado.') {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.status(500).json({ error: 'Erro ao salvar aposta.' });
  }
};

exports.list = async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros de paginação inválidos.' });
  }

  const { take, skip } = normalizePagination(parsed.data);

  try {
    const [bets, total] = await prisma.$transaction([
      prisma.bet.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          userId: true,
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

    const hasMore = skip + bets.length < total;
    const page = Math.floor(skip / take) + 1;

    return res.json({ bets: bets.map(serializeBet), page, pageSize: take, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar apostas.' });
  }
};

exports.myBets = async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros de paginação inválidos.' });
  }

  const { take, skip } = normalizePagination(parsed.data);

  try {
    const [bets, total] = await prisma.$transaction([
      prisma.bet.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
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
          userId: true,
        },
      }),
      prisma.bet.count({ where: { userId: req.userId } }),
    ]);

    const hasMore = skip + bets.length < total;
    return res.json({ bets: bets.map(serializeBet), total, hasMore, take, skip });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar apostas.' });
  }
};
