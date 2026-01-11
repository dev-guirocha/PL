const { z } = require('zod');
const { DateTime } = require('luxon');
const { Prisma } = require('@prisma/client');
const crypto = require('crypto');
const { formatMoney } = require('../utils/money');
const { recordTransaction } = require('../services/financeService');
const prisma = require('../prisma');
const SUPERVISOR_COMMISSION_PCT = Number(process.env.SUPERVISOR_COMMISSION_PCT || 0);
const SUPERVISOR_COMMISSION_BASIS = process.env.SUPERVISOR_COMMISSION_BASIS || 'stake';
const TIMEZONE = 'America/Sao_Paulo';
const DEFAULT_GRACE_MINUTES = 10;
const FEDERAL_DAYS = [3, 6]; // Quarta, Sábado
const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

const betPayloadSchema = z.object({
  loteria: z.string().min(1, 'Loteria é obrigatória'),
  codigoHorario: z.string().min(1, 'Horário é obrigatório'),
  dataJogo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD').optional(),
  apostas: z
    .array(
      z.object({
        jogo: z.string().optional(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD'),
        modalidade: z.string(),
        colocacao: z.string(),
        palpites: z.array(z.union([z.string(), z.number()])).min(1, 'Palpites obrigatórios').max(500, 'Limite de palpites excedido.'),
        modoValor: z.enum(['cada', 'todos']).optional(),
        valorAposta: z.preprocess((val) => Number(val), z.number().positive('Valor deve ser positivo.')),
      }),
    )
    .min(1, 'Envie ao menos uma aposta.')
    .max(200, 'Limite de apostas excedido.'),
});

const toDecimalSafe = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === '') return ZERO;
  try {
    return new Prisma.Decimal(String(value));
  } catch {
    return ZERO;
  }
};

const toMoney = (value) => toDecimalSafe(value).toDecimalPlaces(2);

// Calcula o valor total de forma confiável no backend
function calculateTotal(apostas) {
  return apostas.reduce((acc, ap) => {
    const valor = toMoney(ap.valorAposta);
    const qtd = Array.isArray(ap.palpites) ? ap.palpites.length : 0;
    const subtotal = ap.modoValor === 'cada' ? valor.mul(qtd) : valor;
    return acc.add(subtotal);
  }, ZERO);
}

const getBrazilTodayStr = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(new Date()); // YYYY-MM-DD

const nowInTimezone = () => DateTime.now().setZone(TIMEZONE);

const buildIdempotencyRoute = (req) => {
  const base = req.baseUrl || req.originalUrl || '';
  const clean = String(base).split('?')[0];
  return `${String(req.method || '').toUpperCase()} ${clean}`.trim();
};

const hashPayload = (payload) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const getHourFromCode = (codigoHorario) => {
  if (!codigoHorario) return null;
  const m = String(codigoHorario).match(/(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isNaN(h) ? null : h;
};

const normalizeCodigoHorario = (codigoHorario) => {
  const s = String(codigoHorario || '').trim().toUpperCase();
  const m = s.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return s;
  const hh = String(m[1]).padStart(2, '0');
  const mm = String(m[2] ?? '00').padStart(2, '0');
  return `${hh}:${mm}`;
};

const parseTimeFromCode = (codigoHorario) => {
  if (!codigoHorario) return null;
  const match = String(codigoHorario).match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const buildSlotDateTime = (dataJogoStr, codigoHorario) => {
  const date = DateTime.fromISO(String(dataJogoStr), { zone: TIMEZONE });
  if (!date.isValid) return null;
  const time = parseTimeFromCode(codigoHorario);
  if (!time) return null;
  const slot = date.set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 });
  return slot.isValid ? slot : null;
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
  const slot = buildSlotDateTime(dataJogoStr, codigoHorario);
  if (!slot) return true;
  const deadline = slot.minus({ minutes: DEFAULT_GRACE_MINUTES });
  const now = nowInTimezone();
  return now.toMillis() <= deadline.toMillis();
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

const serializeBetResponse = (bet) => {
  const base = serializeBet(bet);
  return {
    ...base,
    total: formatMoney(bet.total),
    prize: formatMoney(bet.prize || 0),
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
  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key é obrigatório.' });
  }

  // Normaliza payload antes do Zod (fallback de root + apostas como array)
  let rawApostas = req.body?.apostas;
  if (typeof rawApostas === 'string') {
    try {
      rawApostas = JSON.parse(rawApostas);
    } catch {
      rawApostas = [];
    }
  }
  if (!Array.isArray(rawApostas)) rawApostas = [];

  const a0 = rawApostas[0] || {};
  const itemDate = a0.dataJogo ?? a0.data ?? a0.date ?? null;
  const itemHour = a0.codigoHorario ?? a0.horario ?? a0.time ?? null;

  const inferredRootDate = req.body.dataJogo ?? req.body.date ?? itemDate ?? null;

  req.body.apostas = rawApostas.map((a) => ({
    ...a,
    data: a.data ?? a.dataJogo ?? a.date ?? inferredRootDate,
  }));

  req.body.dataJogo = inferredRootDate;
  req.body.codigoHorario = req.body.codigoHorario ?? req.body.horario ?? req.body.time ?? itemHour ?? null;
  req.body.codigoHorario = normalizeCodigoHorario(req.body.codigoHorario);

  const parsed = betPayloadSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors?.[0]?.message || 'Dados de aposta inválidos.' });
  }

  const { loteria, codigoHorario, apostas, dataJogo: rootDataJogo } = parsed.data;
  const dataJogo = rootDataJogo || apostas?.[0]?.data;
  const codigoHorarioNorm = normalizeCodigoHorario(codigoHorario);
  const idempotencyRoute = buildIdempotencyRoute(req) || 'POST /api/bets';
  const requestHash = hashPayload({
    loteria,
    codigoHorario: codigoHorarioNorm,
    dataJogo,
    apostas,
  });

  console.log('[BET_CREATE]', {
    userId: req.userId,
    rootDataJogo: rootDataJogo ?? null,
    itemData: apostas?.[0]?.data ?? null,
    finalDataJogo: dataJogo ?? null,
    rootCodigoHorario: codigoHorarioNorm ?? null,
  });

  if (!dataJogo) {
    return res.status(400).json({ error: 'Data do jogo não identificada.' });
  }

  // Regras FEDERAL (UX + backend)
  const isFederalBet = /FEDERAL/i.test(loteria);
  const day = getDayFromDateStr(dataJogo);
  const hour = getHourFromCode(codigoHorarioNorm);
  const isFederalDay = day !== null && FEDERAL_DAYS.includes(day);

  if (isFederalBet) {
    if (!isFederalDay || hour !== 20) {
      return res.status(400).json({ error: 'Aposta FEDERAL permitida apenas quarta/sábado às 20H.' });
    }
  }

  if (isFederalDay && hour === 18 && /PT[\s-]*RIO|MALUQ/i.test(loteria)) {
    return res.status(400).json({ error: 'Em dia de Federal, use o horário das 20H (Federal) em vez de 18HS.' });
  }

  if (!isBettingAllowed(codigoHorarioNorm, dataJogo)) {
    return res.status(400).json({ error: `Apostas encerradas para o horário ${codigoHorarioNorm} do dia ${dataJogo}.` });
  }

  const totalDebit = calculateTotal(apostas).toDecimalPlaces(2);

  let idempotencyRecord = null;
  try {
    idempotencyRecord = await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId: req.userId,
        route: idempotencyRoute,
        requestHash,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { userId_route_key: { userId: req.userId, route: idempotencyRoute, key: idempotencyKey } },
      });
      if (existing?.requestHash && existing.requestHash !== requestHash) {
        return res.status(409).json({ error: 'Idempotency-Key usada com payload diferente.' });
      }
      if (existing?.response) {
        return res.status(200).json(existing.response);
      }
      return res.status(409).json({ error: 'Requisição em processamento.' });
    }
    return res.status(500).json({ error: 'Erro ao registrar idempotência.' });
  }

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

      const availableBalance = toMoney(userWallet.balance);
      const availableBonus = toMoney(userWallet.bonus);
      const totalAvailable = availableBalance.add(availableBonus);

      if (totalAvailable.lessThan(totalDebit)) {
        const err = new Error('Saldo insuficiente.');
        err.code = 'ERR_NO_BALANCE';
        throw err;
      }

      const debitFromBalance = availableBalance.lessThan(totalDebit) ? availableBalance : totalDebit;
      const debitFromBonus = totalDebit.sub(debitFromBalance).toDecimalPlaces(2);

      const updated = await tx.user.updateMany({
        where: {
          id: req.userId,
          balance: { gte: debitFromBalance },
          bonus: { gte: debitFromBonus },
        },
        data: {
          balance: debitFromBalance.greaterThan(ZERO) ? { decrement: debitFromBalance } : undefined,
          bonus: debitFromBonus.greaterThan(ZERO) ? { decrement: debitFromBonus } : undefined,
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
          codigoHorario: codigoHorarioNorm,
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
        amount: totalDebit.negated(),
        description: `Aposta ${bet.id} - ${loteria} (Saldo: ${debitFromBalance.toFixed(
          2,
        )}, Bônus: ${debitFromBonus.toFixed(2)})`,
        client: tx,
        suppressErrors: false,
      });

      if (user?.supervisorId && SUPERVISOR_COMMISSION_PCT > 0) {
        const commissionAmount = totalDebit
          .mul(new Prisma.Decimal(SUPERVISOR_COMMISSION_PCT))
          .div(HUNDRED)
          .toDecimalPlaces(2);
        if (commissionAmount.greaterThan(ZERO)) {
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

      const responsePayload = {
        message: 'Aposta realizada com sucesso!',
        bet: serializeBetResponse(bet),
        balance: formatMoney(user?.balance),
        bonus: formatMoney(user?.bonus),
        debited: formatMoney(totalDebit),
      };

      await tx.idempotencyKey.update({
        where: { id: idempotencyRecord.id },
        data: { betId: bet.id, response: responsePayload },
      });

      return { bet, user, responsePayload };
    });

    return res.status(201).json(result.responsePayload);
  } catch (err) {
    if (idempotencyRecord?.id) {
      try {
        await prisma.idempotencyKey.delete({ where: { id: idempotencyRecord.id } });
      } catch (cleanupErr) {
        console.warn('Erro ao limpar idempotência:', cleanupErr.message);
      }
    }
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
