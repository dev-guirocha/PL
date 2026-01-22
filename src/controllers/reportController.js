const { DateTime } = require('luxon');
const prisma = require('../prisma');
const { formatMoney } = require('../utils/money');

const TIMEZONE = 'America/Sao_Paulo';

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const intFromAny = (fallback) => {
  const num = Number(fallback);
  if (Number.isNaN(num) || num <= 0) return 10;
  return Math.min(Math.floor(num), 50);
};

exports.listResultPules = async (req, res) => {
  const take = intFromAny(req.query.take || 20);
  const skipRaw = Number(req.query.skip) || 0;
  const skip = Math.max(skipRaw, 0);
  const filterDateRaw = req.query.date ? String(req.query.date) : null;
  const filterLotteryRaw = req.query.loteria ? String(req.query.loteria) : null;
  const filterDate = filterDateRaw ? filterDateRaw.trim() : null;
  const filterLottery = filterLotteryRaw ? filterLotteryRaw.trim() : null;
  const where = {};

  if (filterLottery) {
    where.loteria = filterLottery;
  }

  if (filterDate) {
    where.dataJogo = filterDate;
  }

  try {
    const [items, total] = await prisma.$transaction([
      prisma.resultPule.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        where,
      }),
      prisma.resultPule.count({ where }),
    ]);

    const pules = items.map((p) => ({
      id: p.id,
      resultId: p.resultId,
      loteria: p.loteria,
      codigoHorario: p.codigoHorario,
      dataJogo: p.dataJogo,
      numeros: parseJsonArray(p.numeros),
      grupos: parseJsonArray(p.grupos),
      createdAt: p.createdAt,
      source: 'resultado',
      apostas: [
        {
          modalidade: 'Resultado',
          jogo: p.loteria,
          data: p.dataJogo,
          palpites: parseJsonArray(p.numeros),
          modoValor: 'todos',
          valorAposta: 0,
        },
      ],
      betRef: `RESULT-${p.id}`,
      total: 0,
    }));

    const hasMore = skip + items.length < total;
    return res.json({ pules, total, hasMore, take, skip });
  } catch (err) {
    console.error('Erro ao listar pules de resultado', err);
    return res.status(500).json({ error: 'Erro ao listar pules de resultados.' });
  }
};

// Estatísticas para o painel do supervisor
exports.getSupervisorStats = async (req, res) => {
  try {
    const supervisor = req.supervisor;
    if (!supervisor) return res.status(403).json({ error: 'Acesso restrito a supervisores.' });

    const usersCount = await prisma.user.count({ where: { supervisorId: supervisor.id } });
    const deposits = await prisma.pixCharge.aggregate({
      where: { user: { supervisorId: supervisor.id }, status: { in: ['PAID', 'paid'] } },
      _sum: { amount: true },
    });
    const commissions = await prisma.supervisorCommission.aggregate({
      where: { supervisorId: supervisor.id },
      _sum: { amount: true },
    });

    return res.json({
      supCode: supervisor.code,
      users: usersCount,
      volume: formatMoney(deposits._sum.amount || 0),
      commission: formatMoney(commissions._sum.amount || 0),
    });
  } catch (error) {
    console.error('Erro stats supervisor:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
};

exports.getSupervisorUsers = async (req, res) => {
  try {
    const supervisor = req.supervisor;
    if (!supervisor) return res.status(403).json({ error: 'Acesso restrito a supervisores.' });

    const page = Number(req.query.page) || 1;
    const pageSizeRaw = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
    const skip = (page - 1) * pageSize;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: { supervisorId: supervisor.id, deletedAt: null },
        select: { id: true, name: true, isBlocked: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where: { supervisorId: supervisor.id, deletedAt: null } }),
    ]);

    if (!users.length) {
      return res.json({ users: [], total, page, pageSize });
    }

    const userIds = users.map((u) => u.id);
    const now = DateTime.now().setZone(TIMEZONE);
    const dayStart = now.startOf('day').toJSDate();
    const monthStart = now.startOf('month').toJSDate();

    const [totalAgg, todayAgg, monthAgg, commissionAgg] = await prisma.$transaction([
      prisma.bet.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _sum: { total: true },
      }),
      prisma.bet.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, createdAt: { gte: dayStart } },
        _sum: { total: true },
      }),
      prisma.bet.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.supervisorCommission.groupBy({
        by: ['userId'],
        where: { supervisorId: supervisor.id, userId: { in: userIds } },
        _sum: { amount: true },
      }),
    ]);

    const totalMap = new Map(totalAgg.map((row) => [row.userId, row._sum.total || 0]));
    const todayMap = new Map(todayAgg.map((row) => [row.userId, row._sum.total || 0]));
    const monthMap = new Map(monthAgg.map((row) => [row.userId, row._sum.total || 0]));
    const commissionMap = new Map(commissionAgg.map((row) => [row.userId, row._sum.amount || 0]));

    const payload = users.map((user) => ({
      id: user.id,
      name: user.name,
      isBlocked: Boolean(user.isBlocked),
      totalBet: formatMoney(totalMap.get(user.id) || 0),
      commissionTotal: formatMoney(commissionMap.get(user.id) || 0),
      totalBetToday: formatMoney(todayMap.get(user.id) || 0),
      totalBetMonth: formatMoney(monthMap.get(user.id) || 0),
      profit: formatMoney(commissionMap.get(user.id) || 0),
    }));

    return res.json({ users: payload, total, page, pageSize });
  } catch (error) {
    console.error('Erro ao buscar usuarios do supervisor:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuarios do supervisor.' });
  }
};
