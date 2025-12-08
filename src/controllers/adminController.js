const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const parseIntParam = (value, fallback) => {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.floor(n);
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
    const platformFunds = totalDeposits - totalWithdrawals; // dinheiro em custódia da plataforma

    return res.json({
      usersCount,
      activeUsersLast30d: activeUsers,
      betsCount,
      wallets: { totalBalance, totalBonus },
      platformFunds,
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

const countCombos = (numStr) => {
  const counts = numStr.split('').reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));
  const denom = Object.values(counts).reduce((acc, c) => acc * factorial(c), 1);
  return factorial(numStr.length) / denom;
};

const centenaFrom = (milhar, pos = 'right') => {
  if (pos === 'left') return milhar.slice(0, 3);
  if (pos === 'mid') return milhar.slice(1, 4);
  return milhar.slice(-3);
};

const dezenaFrom = (milhar, pos = 'right') => {
  if (pos === 'left') return milhar.slice(0, 2);
  if (pos === 'mid') return milhar.slice(1, 3);
  return milhar.slice(-2);
};

const unidadeFrom = (milhar) => milhar.slice(-1);

const groupFromDezena = (dezStr) => {
  const num = parseInt(dezStr, 10);
  if (Number.isNaN(num)) return null;
  const val = num === 0 ? 100 : num;
  const group = Math.ceil(val / 4);
  return Math.min(Math.max(group, 1), 25);
};

const parseRanges = (colocacao) => {
  const txt = String(colocacao || '').toLowerCase().replace(/\s+/g, '');
  if (txt.includes('1e1/5') || txt.includes('1e1-5') || txt.includes('1e1a5')) {
    return [
      { positions: [1], divisor: 1, stakeFactor: 0.5 },
      { positions: [1, 2, 3, 4, 5], divisor: 5, stakeFactor: 0.5 },
    ];
  }

  const match = txt.match(/(\d+)\/(\d+)/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (start > 0 && end >= start) {
      const positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      return [{ positions, divisor: positions.length, stakeFactor: 1 }];
    }
  }

  // Padrão cabeça
  return [{ positions: [1], divisor: 1, stakeFactor: 1 }];
};

const settleBetsForResult = async (resultId) => {
  const result = await prisma.result.findUnique({ where: { id: resultId } });
  if (!result) return;

  let numeros = [];
  try {
    numeros = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros || '[]');
  } catch {
    numeros = [];
  }
  const premios = numeros.map(normalizeMilhar); // array de 4 dígitos
  const dezDireita = premios.map((p) => dezenaFrom(p, 'right'));
  const dezEsq = premios.map((p) => dezenaFrom(p, 'left'));
  const dezMeio = premios.map((p) => dezenaFrom(p, 'mid'));
  const centDireita = premios.map((p) => centenaFrom(p, 'right'));
  const centEsq = premios.map((p) => centenaFrom(p, 'left'));

  const gruposDir = dezDireita.map(groupFromDezena);
  const gruposEsq = dezEsq.map(groupFromDezena);
  const gruposMeio = dezMeio.map(groupFromDezena);

  const bets = await prisma.bet.findMany({
    where: { resultId, status: 'open' },
    select: { id: true, userId: true, palpites: true, modalidade: true, colocacao: true, total: true, createdAt: true },
  });

  const calcStake = (ap) => {
    const total = Number(ap.total || 0);
    if (Number(ap.valorPorNumero) > 0) return Number(ap.valorPorNumero);
    if (ap.modoValor === 'cada' && Number(ap.valorAposta) > 0) return Number(ap.valorAposta);
    if (Number(ap.valorAposta) > 0) return Number(ap.valorAposta);
    if (Array.isArray(ap.palpites) && ap.palpites.length > 0 && total > 0) {
      return total / ap.palpites.length;
    }
    return total;
  };

  for (const bet of bets) {
    let apostas = [];
    try {
      apostas = typeof bet.palpites === 'string' ? JSON.parse(bet.palpites) : bet.palpites || [];
    } catch {
      apostas = [];
    }

    let prize = 0;

    const addPrize = (amount) => {
      if (!amount || Number.isNaN(amount)) return;
      prize += amount;
    };

    apostas.forEach((ap) => {
      const modalidadeRaw = String(ap.modalidade || bet.modalidade || '').toUpperCase().trim();
      const palps = Array.isArray(ap.palpites) ? ap.palpites : [];
      const baseStake = calcStake(ap);
      if (!baseStake || palps.length === 0) return;

      // Definições de cercado / faixas
      let ranges = parseRanges(ap.colocacao || bet.colocacao);

      // Helpers para conferência
      const paySimple = (targetChecker, basePayout) => {
        ranges.forEach(({ positions, divisor, stakeFactor }) => {
          const stake = baseStake * (stakeFactor || 1);
          positions.forEach((pos) => {
            const idx = pos - 1;
            if (premios[idx] && targetChecker(idx)) {
              addPrize((stake * basePayout) / divisor);
            }
          });
        });
      };

      const payPermut = (getTarget, basePayout) => {
        ranges.forEach(({ positions, divisor, stakeFactor }) => {
          const stake = baseStake * (stakeFactor || 1);
          palps.forEach((p) => {
            const combos = countCombos(getTarget(String(p)));
            const stakePerCombo = stake / combos;
            positions.forEach((pos) => {
              const idx = pos - 1;
              if (!premios[idx]) return;
              const sigPalp = getTarget(String(p)).split('').sort().join('');
              const sigPrize = getTarget(premios[idx]).split('').sort().join('');
              if (sigPalp === sigPrize) {
                addPrize((stakePerCombo * basePayout) / divisor);
              }
            });
          });
        });
      };

      const modality = modalidadeRaw;

      // Milhar / Centena / Dezena / Unidade / Grupo
      if (modality === 'MILHAR') {
        const base = 4000;
        paySimple(
          (idx) => palps.some((p) => normalizeMilhar(p) === premios[idx]),
          base,
        );
      } else if (modality === 'MILHAR INV' || modality === 'MILHAR INVERTIDA') {
        const base = 4000;
        const target = (num) => normalizeMilhar(num);
        payPermut(target, base);
      } else if (['MILHAR E CT', 'MILHAR E CENTENA', 'MC'].includes(modality)) {
        ranges.forEach(({ positions, divisor, stakeFactor }) => {
          const stake = baseStake * (stakeFactor || 1);
          palps.forEach((p) => {
            const norm = normalizeMilhar(p);
            positions.forEach((pos) => {
              const idx = pos - 1;
              if (!premios[idx]) return;
              if (norm === premios[idx]) {
                addPrize((stake * 4000) / divisor);
              } else if (centenaFrom(norm) === centDireita[idx]) {
                addPrize((stake * 600) / divisor);
              }
            });
          });
        });
      } else if (modality === 'CENTENA') {
        const base = 600;
        paySimple(
          (idx) => palps.some((p) => centenaFrom(normalizeMilhar(p)) === centDireita[idx]),
          base,
        );
      } else if (modality.includes('CENTENA 3X')) {
        const base = 600;
        ranges = [{ positions: [1, 2, 3], divisor: 3, stakeFactor: 1 }];
        paySimple(
          (idx) => palps.some((p) => centenaFrom(normalizeMilhar(p)) === centDireita[idx]),
          base,
        );
      } else if (modality === 'CENTENA INV' || modality === 'CENTENA INVERTIDA') {
        const base = 600;
        payPermut(
          (num) => centenaFrom(normalizeMilhar(num)),
          base,
        );
      } else if (modality === 'CENTENA ESQUERDA' || modality === 'CENTENA ESQ') {
        const base = 600;
        paySimple(
          (idx) => palps.some((p) => centenaFrom(normalizeMilhar(p), 'left') === centEsq[idx]),
          base,
        );
      } else if (modality === 'CENTENA INV ESQ' || modality === 'CENTENA INVERTIDA ESQ') {
        const base = 600;
        payPermut(
          (num) => centenaFrom(normalizeMilhar(num), 'left'),
          base,
        );
      } else if (modality === 'DEZENA') {
        const base = 60;
        paySimple(
          (idx) => palps.some((p) => dezenaFrom(normalizeMilhar(p)) === dezDireita[idx]),
          base,
        );
      } else if (modality === 'DEZENA ESQ' || modality === 'DEZENA ESQUERDA') {
        const base = 60;
        paySimple(
          (idx) => palps.some((p) => dezenaFrom(normalizeMilhar(p), 'left') === dezEsq[idx]),
          base,
        );
      } else if (modality === 'DEZENA MEIO') {
        const base = 60;
        paySimple(
          (idx) => palps.some((p) => dezenaFrom(normalizeMilhar(p), 'mid') === dezMeio[idx]),
          base,
        );
      } else if (modality === 'UNIDADE') {
        const base = 4;
        paySimple(
          (idx) => palps.some((p) => unidadeFrom(normalizeMilhar(p)) === unidadeFrom(premios[idx])),
          base,
        );
      } else if (modality.startsWith('GRUPO')) {
        const base = 18;
        const posType = modality.includes('ESQ') ? 'left' : modality.includes('MEIO') ? 'mid' : 'right';
        const targetGrupos = posType === 'left' ? gruposEsq : posType === 'mid' ? gruposMeio : gruposDir;
        paySimple(
          (idx) => palps.some((p) => {
            const grp = groupFromDezena(String(p).padStart(2, '0'));
            return grp && grp === targetGrupos[idx];
          }),
          base,
        );
      } else if (modality.includes('DUQUE DE DEZ')) {
        const base = 300;
        const targetList = dezDireita.slice(0, 5);
        const pal = palps.map((p) => String(p).padStart(2, '0')).slice(0, 2);
        const ok = pal.length === 2 && pal.every((d) => targetList.includes(d));
        if (ok) addPrize(baseStake * base);
      } else if (modality.includes('TERNO DE DEZ')) {
        const base = 3000;
        const targetList = dezDireita.slice(0, 5);
        const pal = palps.map((p) => String(p).padStart(2, '0')).slice(0, 3);
        const ok = pal.length === 3 && pal.every((d) => targetList.includes(d));
        if (ok) addPrize(baseStake * base);
      } else if (modality.includes('DUQUE GP')) {
        const base = 18.5;
        const posType = modality.includes('ESQ') ? 'left' : modality.includes('MEIO') ? 'mid' : 'right';
        const targetList = (posType === 'left' ? gruposEsq : posType === 'mid' ? gruposMeio : gruposDir).slice(0, 5);
        const pal = palps.map((p) => parseInt(p, 10)).slice(0, 2);
        const ok = pal.length === 2 && pal.every((g) => targetList.includes(g));
        if (ok) addPrize(baseStake * base);
      } else if (modality.includes('TERNO GP')) {
        const base = 130;
        const posType = modality.includes('ESQ') ? 'left' : modality.includes('MEIO') ? 'mid' : 'right';
        const targetList = (posType === 'left' ? gruposEsq : posType === 'mid' ? gruposMeio : gruposDir).slice(0, 5);
        const pal = palps.map((p) => parseInt(p, 10)).slice(0, 3);
        const ok = pal.length === 3 && pal.every((g) => targetList.includes(g));
        if (ok) addPrize(baseStake * base);
      } else if (modality === 'PASSE VAI') {
        const base = 80;
        const pal = palps.map((p) => parseInt(p, 10));
        if (pal.length >= 2) {
          const a = pal[0];
          const b = pal[1];
          const headGrp = gruposDir[0];
          const rest = gruposDir.slice(1, 5);
          if (headGrp === a && rest.includes(b)) addPrize(baseStake * base);
        }
      } else if (modality === 'PASSE VAI VEM' || modality === 'PASSE VAI-VEM') {
        const base = 40;
        const pal = palps.map((p) => parseInt(p, 10));
        if (pal.length >= 2) {
          const a = pal[0];
          const b = pal[1];
          const headGrp = gruposDir[0];
          const rest = gruposDir.slice(1, 5);
          if ((headGrp === a && rest.includes(b)) || (headGrp === b && rest.includes(a))) {
            addPrize(baseStake * base);
          }
        }
      }
    });

    const status = prize > 0 ? 'won' : 'lost';
    await prisma.$transaction(async (tx) => {
      await tx.bet.update({
        where: { id: bet.id },
        data: { status, prize, settledAt: new Date() },
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
            description: `Prêmio aposta ${bet.id}`,
          },
        });
      }
    });
  }
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
      return { ...bet, apostas, betRef: `${bet.userId}-${bet.id}` };
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

exports.createSupervisor = async (req, res) => {
  const { name, phone, code } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: 'Informe nome e código do supervisor.' });
  }
  try {
    const supervisor = await prisma.supervisor.create({
      data: { name, phone: phone || null, code: String(code).trim().toUpperCase() },
    });
    return res.status(201).json({ supervisor });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Código de supervisor já existe.' });
    }
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
  const { loteria, codigoHorario, dataJogo, numeros } = req.body || {};
  if (!loteria || !numeros || !Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: 'Informe loteria e lista de números/resultados.' });
  }

  try {
    const created = await prisma.result.create({
      data: {
        loteria,
        codigoHorario: codigoHorario || null,
        dataJogo: dataJogo || null,
        numeros: JSON.stringify(numeros),
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

    await settleBetsForResult(created.id);

    return res.status(201).json({ result: created });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar resultado.' });
  }
};

exports.listResults = async (req, res) => {
  const page = parseIntParam(req.query.page, 1);
  const rawSize = parseIntParam(req.query.pageSize, 20);
  const pageSize = Math.min(rawSize, 50);
  const skip = (page - 1) * pageSize;

  try {
    const [items, total] = await prisma.$transaction([
      prisma.result.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { bets: { select: { id: true, userId: true, total: true } } },
      }),
      prisma.result.count(),
    ]);

    const formatted = items.map((r) => ({
      ...r,
      numeros: (() => {
        try {
          return JSON.parse(r.numeros);
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
