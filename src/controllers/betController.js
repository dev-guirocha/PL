const { z } = require('zod');
const { recordTransaction } = require('../services/financeService');
const prisma = require('../prisma');
const SUPERVISOR_COMMISSION_PCT = Number(process.env.SUPERVISOR_COMMISSION_PCT || 0);
const SUPERVISOR_COMMISSION_BASIS = process.env.SUPERVISOR_COMMISSION_BASIS || 'stake';
const TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_GRACE_MINUTES = 10;
const FEDERAL_DAYS = [3, 6]; // Quarta, Sábado

const betPayloadSchema = z.object({
  loteria: z.string().min(1, 'Loteria é obrigatória'),
  codigoHorario: z.string().min(1, 'Horário é obrigatório'),
  apostas: z
    .array(
      z.object({
        jogo: z.string().optional(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD'),
        modalidade: z.string(),
        colocacao: z.string(),
        palpites: z.array(z.union([z.string(), z.number()])).min(1, 'Palpites obrigatórios'),
        modoValor: z.enum(['cada', 'todos']).optional(),
        valorAposta: z.preprocess((val) => Number(val), z.number().positive('Valor deve ser positivo.')),
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

const getBrazilTodayStr = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(new Date()); // YYYY-MM-DD

const parseNowInTimezone = () => {
  const now = new Date();
  const tzString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  return new Date(tzString);
};

const getHourFromCode = (codigoHorario) => {
  if (!codigoHorario) return null;
  const m = String(codigoHorario).match(/(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isNaN(h) ? null : h;
};

const getDayFromDateStr = (dateStr) => {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  // Usa meio-dia local para evitar rollback de fuso (UTC -> dia anterior)
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const day = date.getDay();
  return Number.isNaN(day) ? null : day;
};

const isBettingAllowed = (codigoHorario, dataJogoStr) => {
  if (!codigoHorario || !dataJogoStr) return true;
  // Tenta extrair HH:mm do código/horário
  const match = String(codigoHorario).match(/(\d{1,2}):(\d{2})/);
  if (!match) return true;
  const [_, hh, mm] = match;
  const slotStr = `${dataJogoStr}T${hh.padStart(2, '0')}:${mm}:00`;
  const slot = new Date(`${slotStr}-03:00`); // TZ Brasil fixa; simplificação
  if (Number.isNaN(slot.getTime())) return true;
  const deadline = new Date(slot.getTime() - DEFAULT_GRACE_MINUTES * 60 * 1000);
  const now = parseNowInTimezone();
  return now <= deadline;
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
    status: bet.status,
    prize: bet.prize,
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
    return res.status(400).json({ error: parsed.error.errors?.[0]?.message || 'Dados de aposta inválidos.' });
  }

  const { loteria, codigoHorario, apostas } = parsed.data;
  const dataJogo = apostas[0].data;

  // Regras FEDERAL (UX + backend)
  const isFederalBet = /FEDERAL/i.test(codigoHorario) || /FEDERAL/i.test(loteria);
  const day = getDayFromDateStr(dataJogo);
  const hour = getHourFromCode(codigoHorario);
  const isFederalDay = day !== null && FEDERAL_DAYS.includes(day);

  if (isFederalBet) {
    if (!isFederalDay || hour !== 20) {
      return res.status(400).json({ error: 'Aposta FEDERAL permitida apenas quarta/sábado às 20H.' });
    }
  }

  if (isFederalDay && hour === 18 && /PT[\s-]*RIO|MALUQ/i.test(loteria)) {
    return res.status(400).json({ error: 'Em dia de Federal, use o horário das 20H (Federal) em vez de 18HS.' });
  }

  if (!isBettingAllowed(codigoHorario, dataJogo)) {
    return res.status(400).json({ error: `Apostas encerradas para o horário ${codigoHorario} do dia ${dataJogo}.` });
  }

  const totalDebit = calculateTotal(apostas);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const userWallet = await tx.user.findUnique({
        where: { id: req.userId },
        select: { balance: true, bonus: true, supervisorId: true },
      });

      if (!userWallet) {
        const err = new Error('Usuário não encontrado.');
        err.code = 'ERR_NO_USER';
        throw err;
      }

      const availableBalance = Number(userWallet.balance || 0);
      const availableBonus = Number(userWallet.bonus || 0);
      const totalAvailable = availableBalance + availableBonus;

      if (totalAvailable < totalDebit) {
        const err = new Error('Saldo insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }

      const debitFromBalance = Math.min(availableBalance, totalDebit);
      const debitFromBonus = Number((totalDebit - debitFromBalance).toFixed(2));

      const updated = await tx.user.updateMany({
        where: {
          id: req.userId,
          balance: { gte: debitFromBalance },
          bonus: { gte: debitFromBonus },
        },
        data: {
          balance: debitFromBalance > 0 ? { decrement: debitFromBalance } : undefined,
          bonus: debitFromBonus > 0 ? { decrement: debitFromBonus } : undefined,
        },
      });

      if (!updated.count) {
        const err = new Error('Saldo insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }

      const bet = await tx.bet.create({
        data: {
          userId: req.userId,
          loteria,
          codigoHorario,
          dataJogo,
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
        description: `Aposta ${bet.id} - ${loteria} (Saldo: ${debitFromBalance.toFixed(
          2,
        )}, Bônus: ${debitFromBonus.toFixed(2)})`,
        client: tx,
        suppressErrors: false,
      });

      if (user?.supervisorId && SUPERVISOR_COMMISSION_PCT > 0) {
        const commissionAmount = Number(((totalDebit * SUPERVISOR_COMMISSION_PCT) / 100).toFixed(2));
        if (commissionAmount > 0) {
          try {
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
          } catch (e) {
            console.warn('Erro ao registrar comissão do supervisor:', e.message);
          }
        }
      }

      return { bet, user };
    });

    return res.status(201).json({
      message: 'Aposta realizada com sucesso!',
      bet: serializeBet(result.bet),
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
  const rawStatuses = parsed.data.statuses || parsed.data.status || req.query.statuses || req.query.status;
  const statuses = rawStatuses
    ? String(rawStatuses)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : null;

  try {
    const where = { userId: req.userId };
    if (statuses && statuses.length) {
      where.status = { in: statuses };
    }

    const [bets, total] = await prisma.$transaction([
      prisma.bet.findMany({
        where,
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
          status: true,
          prize: true,
        },
      }),
      prisma.bet.count({ where }),
    ]);

    const hasMore = skip + bets.length < total;
    return res.json({ bets: bets.map(serializeBet), total, hasMore, take, skip });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar apostas.' });
  }
};
