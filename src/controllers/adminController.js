const prisma = require('../prisma');
const { PAYOUTS } = require('../constants/payouts');

const parseIntParam = (value, fallback) => {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.floor(n);
};

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

const serializeResultPule = (pule) => {
  const numeros = parseJsonArray(pule.numeros);
  const grupos = parseJsonArray(pule.grupos);
  return {
    id: pule.id,
    resultId: pule.resultId,
    loteria: pule.loteria,
    codigoHorario: pule.codigoHorario,
    dataJogo: pule.dataJogo,
    numeros,
    grupos,
    createdAt: pule.createdAt,
    source: 'resultado',
  };
};

exports.stats = async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [usersCount, betsCount, balanceAgg, depositsAgg, betsAgg, withdrawalsAgg, activeUsersGroup] = await Promise.all([
      prisma.user.count(),
      prisma.bet.count(),
      prisma.user.aggregate({ _sum: { balance: true, bonus: true } }),
      prisma.transaction.aggregate({ where: { type: 'deposit' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'bet' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'withdraw' }, _sum: { amount: true } }),
      prisma.bet.groupBy({ by: ['userId'], where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const totalDeposits = depositsAgg._sum.amount || 0;
    const totalBetsOut = Math.abs(betsAgg._sum.amount || 0); // são negativos
    const totalWithdrawals = Math.abs(withdrawalsAgg._sum.amount || 0);
    const totalBalance = balanceAgg._sum.balance || 0;
    const totalBonus = balanceAgg._sum.bonus || 0;
    const activeUsers = activeUsersGroup.length;
    const platformFunds = totalBetsOut; // total apostado na plataforma

    return res.json({
      usersCount,
      activeUsersLast30d: activeUsers,
      betsCount,
      wallets: {
        saldo: totalBalance,
        bonus: totalBonus,
        total: (totalBalance || 0) + (totalBonus || 0),
      },
      platformFunds, // total apostado
      moneyIn: { deposits: totalDeposits },
      moneyOut: { bets: totalBetsOut, withdrawals: totalWithdrawals },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar estatísticas admin.' });
  }
};

const normalizeMilhar = (val) => {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
};

const getSlice = (milhar, type) => {
  const m = normalizeMilhar(milhar);
  switch (type) {
    case 'MILHAR':
      return m;
    case 'CENTENA':
      return m.slice(-3);
    case 'DEZENA':
      return m.slice(-2);
    case 'UNIDADE':
      return m.slice(-1);
    default:
      return m;
  }
};

const getGrupo = (milhar) => {
  const dezena = parseInt(normalizeMilhar(milhar).slice(-2), 10);
  if (Number.isNaN(dezena)) return null;
  if (dezena === 0) return 25;
  return Math.ceil(dezena / 4);
};

const parseColocacao = (colocacaoStr) => {
  const c = (colocacaoStr || '').toUpperCase().trim();

  if (c.includes('1 E 1/5') || c.includes('1E1/5')) {
    return [
      { indices: [0], divisor: 1, stakeFactor: 0.5 },
      { indices: [0, 1, 2, 3, 4], divisor: 5, stakeFactor: 0.5 },
    ];
  }

  if (c.includes('1/5') || c.includes('1 AO 5') || c.includes('1A5') || c.includes('1 AO5')) {
    return [{ indices: [0, 1, 2, 3, 4], divisor: 5, stakeFactor: 1 }];
  }

  return [{ indices: [0], divisor: 1, stakeFactor: 1 }];
};

const settleBetsForResult = async (resultId) => {
  const result = await prisma.result.findUnique({ where: { id: resultId } });
  if (!result) return { totalBets: 0, processed: 0, wins: 0, errors: [] };

  let numeros = [];
  let grupos = [];
  try {
    numeros = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros || '[]');
  } catch {
    numeros = [];
  }
  try {
    grupos = result.grupos ? (Array.isArray(result.grupos) ? result.grupos : JSON.parse(result.grupos || '[]')) : [];
  } catch {
    grupos = [];
  }
  const premios = numeros.map(normalizeMilhar); // posições 0..n, 0 = 1º prêmio

  const bets = await prisma.bet.findMany({
    where: {
      status: 'open',
      OR: [
        { loteria: result.loteria, codigoHorario: result.codigoHorario },
        { codigoHorario: result.codigoHorario },
        { loteria: result.loteria },
      ],
    },
    select: { id: true, userId: true, palpites: true, modalidade: true, colocacao: true, total: true, resultId: true, dataJogo: true },
  });

  const summary = { totalBets: bets.length, processed: 0, wins: 0, errors: [], matchedBetIds: bets.map((b) => b.id) };

  for (const bet of bets) {
    try {
      let palpites = [];
      try {
        palpites = typeof bet.palpites === 'string' ? JSON.parse(bet.palpites) : bet.palpites || [];
      } catch {
        palpites = [];
      }

      if (!Array.isArray(palpites) && palpites.apostas) {
        palpites = palpites.apostas;
      }

      const modal = (bet.modalidade || '').toUpperCase().trim();
      const payout = PAYOUTS[modal] || 0;
      if (!payout) {
        await prisma.bet.update({ where: { id: bet.id }, data: { status: 'lost', settledAt: new Date(), resultId } });
        summary.processed += 1;
        continue;
      }

      const colocacoes = parseColocacao(bet.colocacao);
      const unitStake =
        bet.total && palpites.length
          ? Number(bet.total) / palpites.length
          : Number(bet.total || 0) / (palpites.length || 1);
      let prize = 0;

      palpites.forEach((palpite) => {
        const palpStr = String(palpite).trim();
        const palNorm = normalizeMilhar(palpStr);
        const palGrupo = getGrupo(palpStr);

        colocacoes.forEach(({ indices, divisor, stakeFactor }) => {
          indices.forEach((idx) => {
            const sorteado = premios[idx];
            if (!sorteado) return;
            const sorteioGrupo = getGrupo(sorteado);

            let isWin = false;

            // Modalidade CENTENA: compara últimas 3 casas
            if (modal.includes('CENTENA')) {
              isWin = getSlice(sorteado, 'CENTENA') === getSlice(palNorm, 'CENTENA');
            } else if (modal.includes('DEZENA')) {
              isWin = getSlice(sorteado, 'DEZENA') === getSlice(palNorm, 'DEZENA');
            } else if (modal.includes('UNIDADE')) {
              isWin = getSlice(sorteado, 'UNIDADE') === getSlice(palNorm, 'UNIDADE');
            } else if (modal.includes('MILHAR')) {
              isWin = getSlice(sorteado, 'MILHAR') === getSlice(palNorm, 'MILHAR');
            } else if (modal.includes('GRUPO') && palGrupo) {
              isWin = sorteioGrupo === Number(palpite);
            }

            if (isWin) {
              const stake = unitStake * (stakeFactor || 1);
              prize += (stake * payout) / divisor;
            }
          });
        });
      });

      const status = prize > 0 ? 'won' : 'nao premiado';
      await prisma.$transaction(async (tx) => {
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status,
            prize,
            settledAt: new Date(),
            resultId: resultId,
          },
        });

        if (prize > 0) {
          await tx.user.update({
            where: { id: bet.userId },
            data: { balance: { increment: prize } },
          });

          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: 'prize',
              amount: prize,
              description: `Prêmio ${modal} - ${result.loteria || ''} (${bet.id})`,
            },
          });
        }
      });

      summary.processed += 1;
      if (prize > 0) summary.wins += 1;
    } catch (err) {
      console.error('Erro ao liquidar aposta', bet.id, err);
      summary.errors.push({ betId: bet.id, message: err?.message || 'Erro desconhecido' });
    }
  }

  return summary;
};

exports.listBets = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;

  try {
    const [bets, total] = await prisma.$transaction([
      prisma.bet.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          loteria: true,
          codigoHorario: true,
          total: true,
          status: true,
          createdAt: true,
          dataJogo: true,
          modalidade: true,
          palpites: true,
          user: { select: { name: true, phone: true } },
        },
      }),
      prisma.bet.count(),
    ]);

    const formatted = bets.map((bet) => {
      let apostas = [];
      try {
        apostas = typeof bet.palpites === 'string' ? JSON.parse(bet.palpites) : bet.palpites || [];
      } catch {
        apostas = [];
      }
      const statusAliases = {
        perdeu: 'nao premiado',
        lost: 'nao premiado',
        'não premiado': 'nao premiado',
      };
      const normalizedStatus = statusAliases[String(bet.status || '').toLowerCase()] || bet.status;
      return { ...bet, status: normalizedStatus, apostas, betRef: `${bet.userId}-${bet.id}` };
    });

    const hasMore = skip + bets.length < total;

    return res.json({ bets: formatted, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar apostas.' });
  }
};

exports.listUsers = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;

  try {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          phone: true,
          balance: true,
          bonus: true,
          createdAt: true,
        },
      }),
      prisma.user.count(),
    ]);

    const hasMore = skip + users.length < total;
    return res.json({ users, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
};

exports.deleteUser = async (req, res) => {
  const rawId = req.params.id || req.query.id;
  const userId = parseInt(rawId, 10);

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'ID do usuário inválido.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    await prisma.$transaction([
      prisma.supervisorCommission.deleteMany({ where: { userId } }),
      prisma.withdrawalRequest.deleteMany({ where: { userId } }),
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.pixCharge.deleteMany({ where: { userId } }),
      prisma.bet.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao apagar usuário', err);
    return res.status(500).json({ error: 'Erro ao apagar usuário.' });
  }
};

exports.createSupervisor = async (req, res) => {
  const { name, phone, code } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Informe o nome do supervisor.' });
  }
  try {
    const base = code ? String(code).trim().toUpperCase() : '';
    const namePart = String(name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    const suffix = Math.floor(100 + Math.random() * 900); // 3 dígitos
    const sanitized = base.replace(/^99/, '') || namePart || 'SUP';
    const finalCode = `99${sanitized}${suffix}`;

    const supervisor = await prisma.supervisor.create({
      data: { name, phone: phone || null, code: finalCode },
    });
    return res.status(201).json({ supervisor });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Código de supervisor já existe.' });
    }
    console.error('Erro ao criar supervisor', err);
    return res.status(500).json({ error: 'Erro ao criar supervisor.' });
  }
};

exports.listSupervisors = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;
  try {
    const [items, total] = await prisma.$transaction([
      prisma.supervisor.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { users: { select: { id: true, name: true, phone: true } } },
      }),
      prisma.supervisor.count(),
    ]);
    const hasMore = skip + items.length < total;
    return res.json({ supervisors: items, page, pageSize, total, hasMore });
  } catch {
    return res.status(500).json({ error: 'Erro ao listar supervisores.' });
  }
};

exports.createResult = async (req, res) => {
  const { loteria, codigoHorario, dataJogo, numeros, grupos } = req.body || {};
  if (!loteria || !numeros || !Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: 'Informe loteria e lista de números/resultados.' });
  }

  try {
    const numerosNorm = numeros.map((n) => normalizeMilhar(n));
    let gruposFinal = [];
    try {
      gruposFinal = Array.isArray(grupos) ? grupos : JSON.parse(grupos || '[]');
    } catch {
      gruposFinal = [];
    }
    // Se grupos não vieram ou estão incompletos, calcula a partir da dezena.
    if (!gruposFinal.length || gruposFinal.length < numerosNorm.length) {
      gruposFinal = numerosNorm.map((n, idx) => {
        const provided = gruposFinal[idx];
        if (provided) return provided;
        const g = getGrupo(n);
        return g ? String(g).padStart(2, '0') : null;
      });
    }

    const created = await prisma.result.create({
      data: {
        loteria,
        codigoHorario: codigoHorario || null,
        dataJogo: dataJogo || null,
        numeros: JSON.stringify(numerosNorm),
        grupos: gruposFinal.length ? JSON.stringify(gruposFinal) : null,
      },
    });

    await prisma.bet.updateMany({
      where: {
        loteria,
        ...(codigoHorario ? { codigoHorario } : {}),
        ...(dataJogo ? { dataJogo } : {}),
      },
      data: { resultId: created.id },
    });

    setImmediate(() => {
      settleBetsForResult(created.id).catch((err) => {
        console.error(`Erro ao liquidar apostas para resultado ${created.id}`, err);
      });
    });

    return res.status(201).json({ result: created, settling: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar resultado.' });
  }
};

exports.settleResult = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const exists = await prisma.result.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Resultado não encontrado.' });

    const summary = await settleBetsForResult(id);
    return res.json({ message: 'Liquidação concluída.', summary });
  } catch (err) {
    console.error('Erro ao liquidar resultado', err);
    return res.status(500).json({ error: 'Erro ao liquidar apostas para este resultado.' });
  }
};

exports.generateResultPule = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado.' });

    const existing = await prisma.resultPule.findFirst({ where: { resultId: id } });
    if (existing) {
      return res.json({ pule: serializeResultPule(existing), alreadyExists: true });
    }

    const numeros = parseJsonArray(result.numeros);
    const grupos = parseJsonArray(result.grupos);

    const created = await prisma.resultPule.create({
      data: {
        resultId: result.id,
        loteria: result.loteria,
        codigoHorario: result.codigoHorario,
        dataJogo: result.dataJogo,
        numeros: JSON.stringify(numeros),
        grupos: grupos.length ? JSON.stringify(grupos) : null,
      },
    });

    return res.status(201).json({ pule: serializeResultPule(created) });
  } catch (err) {
    console.error('Erro ao gerar pule de resultado', err);
    return res.status(500).json({ error: 'Erro ao gerar PULE.' });
  }
};

exports.listResults = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;
  const filterDate = req.query.date ? String(req.query.date) : null;
  const filterLottery = req.query.loteria ? String(req.query.loteria) : null;
  const where = {
    ...(filterLottery ? { loteria: filterLottery } : {}),
    ...(filterDate ? { dataJogo: filterDate } : {}),
  };

  try {
    const [items, total] = await prisma.$transaction([
      prisma.result.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        where,
        include: { bets: { select: { id: true, userId: true, total: true } } },
      }),
      prisma.result.count({ where }),
    ]);

    const formatted = items.map((r) => ({
      ...r,
      numeros: (() => {
        try {
          return Array.isArray(r.numeros) ? r.numeros : JSON.parse(r.numeros || '[]');
        } catch {
          return [];
        }
      })(),
      grupos: (() => {
        try {
          return Array.isArray(r.grupos) ? r.grupos : JSON.parse(r.grupos || '[]');
        } catch {
          return [];
        }
      })(),
    }));

    const hasMore = skip + items.length < total;
    return res.json({ results: formatted, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar resultados.' });
  }
};

exports.listWithdrawals = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;
  const status = (req.query.status || '').toString().toLowerCase();

  try {
    const [items, total] = await prisma.$transaction([
      prisma.withdrawalRequest.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { user: { select: { id: true, name: true, phone: true } } },
      }),
      prisma.withdrawalRequest.count({ where: status ? { status } : {} }),
    ]);

    const hasMore = skip + items.length < total;
    return res.json({ withdrawals: items, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar saques.' });
  }
};

exports.updateWithdrawalStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = ['pending', 'approved', 'rejected', 'paid'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id: Number(id) } });
    if (!withdrawal) return res.status(404).json({ error: 'Solicitação não encontrada.' });

    await prisma.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status } });

    // Log simples em transactions quando marcado como paid
    if (status === 'paid') {
      await prisma.transaction.create({
        data: {
          userId: withdrawal.userId,
          type: 'withdraw',
          amount: -Math.abs(withdrawal.amount),
          description: 'Saque pago (admin)',
        },
      });
    }

    return res.json({ message: 'Status atualizado.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar saque.' });
  }
};

exports.createCoupon = async (req, res) => {
  const { code, type = 'bonus', amount, expiresAt } = req.body || {};
  if (!code || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Informe código e valor do cupom.' });
  }
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: String(code).trim().toUpperCase(),
        type,
        amount: Number(amount),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return res.status(201).json({ coupon });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Código de cupom já existe.' });
    }
    return res.status(500).json({ error: 'Erro ao criar cupom.' });
  }
};

exports.listCoupons = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;
  const active = req.query.active;
  const where = {};
  if (typeof active !== 'undefined') {
    where.active = active === 'true' || active === true;
  }
  try {
    const [items, total] = await prisma.$transaction([
      prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.coupon.count({ where }),
    ]);
    const hasMore = skip + items.length < total;
    return res.json({ coupons: items, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar cupons.' });
  }
};

exports.deleteSupervisor = async (req, res) => {
  const { id } = req.params;
  try {
    const supId = Number(id);
    const supervisor = await prisma.supervisor.findUnique({ where: { id: supId }, include: { users: true } });
    if (!supervisor) return res.status(404).json({ error: 'Supervisor não encontrado.' });

    // Desvincula usuários antes de remover
    await prisma.$transaction([
      prisma.user.updateMany({ where: { supervisorId: supId }, data: { supervisorId: null } }),
      prisma.supervisor.delete({ where: { id: supId } }),
    ]);

    return res.json({ message: 'Supervisor excluído e usuários desvinculados.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir supervisor.' });
  }
};

exports.updateSupervisor = async (req, res) => {
  const { id } = req.params;
  const { name, phone } = req.body || {};
  const supId = Number(id);
  if (!supId || Number.isNaN(supId)) return res.status(400).json({ error: 'ID inválido.' });
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

  try {
    const supervisor = await prisma.supervisor.findUnique({ where: { id: supId } });
    if (!supervisor) return res.status(404).json({ error: 'Supervisor não encontrado.' });

    const updated = await prisma.supervisor.update({
      where: { id: supId },
      data: { name, phone: phone || null },
    });

    return res.json({ supervisor: updated });
  } catch (err) {
    console.error('Erro ao atualizar supervisor', err);
    return res.status(500).json({ error: 'Erro ao atualizar supervisor.' });
  }
};
