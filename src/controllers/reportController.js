const prisma = require('../prisma');

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
    const phoneClean = (req.user.phone || '').replace(/\D/g, '');
    const supervisor = await prisma.supervisor.findFirst({
      where: {
        OR: [{ phone: phoneClean }, { name: req.user.name }],
      },
    });

    if (!supervisor) {
      return res.status(404).json({ error: 'Você não é supervisor.' });
    }

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
      volume: Number(deposits._sum.amount || 0),
      commission: Number(commissions._sum.amount || 0),
    });
  } catch (error) {
    console.error('Erro stats supervisor:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
};
