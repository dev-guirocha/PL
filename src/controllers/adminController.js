const prisma = require('../prisma');
const PAYOUTS = require('../constants/payouts.json');

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
    const [usersCount, betsCount, balanceAgg, depositsAgg, betsAgg, withdrawalsAgg, pendingWithdrawalsAgg, activeUsersGroup] = await Promise.all([
      prisma.user.count(),
      prisma.bet.count(),
      prisma.user.aggregate({ _sum: { balance: true, bonus: true } }),
      prisma.transaction.aggregate({ where: { type: 'deposit' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'bet' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'withdraw' }, _sum: { amount: true } }),
      prisma.withdrawalRequest.aggregate({
        where: { status: { in: ['pending', 'approved'] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.bet.groupBy({ by: ['userId'], where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const totalDeposits = depositsAgg._sum.amount || 0;
    const totalBetsOut = Math.abs(betsAgg._sum.amount || 0); // são negativos
    const totalWithdrawals = Math.abs(withdrawalsAgg._sum.amount || 0);
    const totalBalance = Number(balanceAgg._sum.balance || 0);
    const totalBonus = Number(balanceAgg._sum.bonus || 0);
    const pendingWithdrawals = {
      amount: Number(pendingWithdrawalsAgg._sum.amount || 0),
      count: pendingWithdrawalsAgg._count?._all || 0,
    };
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
      pendingWithdrawals,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar estatísticas admin.' });
  }
};

exports.manualCreditPix = async (req, res) => {
  const { txid } = req.body || {};
  if (!txid) return res.status(400).json({ error: 'txid é obrigatório.' });

  try {
    const charge = await prisma.pixCharge.findFirst({ where: { txid: String(txid) } });
    if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada.' });
    if (charge.credited) return res.json({ message: 'Cobrança já creditada.', charge });

    await prisma.$transaction(async (tx) => {
      await tx.pixCharge.update({
        where: { id: charge.id },
        data: { status: 'paid', paidAt: new Date(), credited: true },
      });
      await tx.user.update({
        where: { id: charge.userId },
        data: { balance: { increment: charge.amount } },
      });
      await tx.transaction.create({
        data: {
          userId: charge.userId,
          type: 'deposit',
          amount: charge.amount,
          description: `Depósito PIX manual (txid ${txid})`,
        },
      });
    });

    return res.json({ message: 'Cobrança creditada manualmente.', txid });
  } catch (err) {
    console.error('Erro manualCreditPix', err);
    return res.status(500).json({ error: 'Erro ao creditar Pix.' });
  }
};

const normalizeMilhar = (val) => {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
};

const normalizeDezena = (val) => {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.slice(-2).padStart(2, '0');
};

const getNormalizerForGame = (loteriaStr) => {
  const nome = (loteriaStr || '').toUpperCase();
  if (nome.includes('QUININHA') || nome.includes('SENINHA') || nome.includes('SUPER')) {
    return normalizeDezena;
  }
  return normalizeMilhar;
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

const factorial = (n) => {
  if (!n || n < 0) return 1;
  return n <= 1 ? 1 : n * factorial(n - 1);
};

const countPermutations = (digits) => {
  const clean = (digits || '').toString();
  if (!clean) return 1;
  const counts = clean.split('').reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const denominator = Object.values(counts).reduce((acc, qty) => acc * factorial(qty), 1);
  return Math.max(1, factorial(clean.length) / denominator);
};

const sameDigits = (a, b) => {
  const sort = (val) => (val || '').toString().split('').sort().join('');
  return sort(a) === sort(b);
};

const normalizeModal = (modal) => (modal || '').toString().toUpperCase().trim();

const resolvePayout = (modal) => {
  const key = normalizeModal(modal);
  if (PAYOUTS[key]) return PAYOUTS[key];

  const withoutInv = key.replace(/\s+INV\b/g, '').trim();
  if (PAYOUTS[withoutInv]) return PAYOUTS[withoutInv];

  const withoutSide = withoutInv.replace(/\s+(ESQ|MEIO)\b/g, '').trim();
  if (PAYOUTS[withoutSide]) return PAYOUTS[withoutSide];

  if (key.includes('GRUPO')) return PAYOUTS.GRUPO || 0;
  if (key.includes('DEZENA')) return PAYOUTS.DEZENA || 0;
  if (key.includes('CENTENA')) return PAYOUTS.CENTENA || 0;
  if (key.includes('MILHAR')) return PAYOUTS.MILHAR || 0;
  return 0;
};

const getSegmentForModal = (modal, numero) => {
  const normalized = normalizeMilhar(numero);
  const key = normalizeModal(modal);
  if (key.includes('MILHAR')) return normalized;

  if (key.includes('CENTENA')) {
    if (key.includes('ESQ')) return normalized.slice(0, 3);
    if (key.includes('MEIO')) return normalized.slice(1, 4);
    return normalized.slice(-3);
  }

  if (key.includes('DEZENA') || key.includes('GRUPO')) {
    if (key.includes('ESQ')) return normalized.slice(0, 2);
    if (key.includes('MEIO')) return normalized.slice(1, 3);
    return normalized.slice(-2);
  }

  if (key.includes('UNIDADE')) return normalized.slice(-1);
  return normalized;
};

const matchModalidade = (modal, palpite, sorteado) => {
  const key = normalizeModal(modal);

  if (key.includes('GRUPO')) {
    const palGrupo = Number(palpite);
    const targetSegment = getSegmentForModal(key, sorteado);
    const sorteioGrupo = getGrupo(targetSegment);
    return palGrupo && sorteioGrupo && palGrupo === sorteioGrupo;
  }

  // Modalidade que paga milhar ou centena
  if (key.includes('MILHAR E CT')) {
    const palMilhar = getSegmentForModal('MILHAR', palpite);
    const palCentena = getSegmentForModal('CENTENA', palpite);
    const sorteioMilhar = getSegmentForModal('MILHAR', sorteado);
    const sorteioCentena = getSegmentForModal('CENTENA', sorteado);
    if (key.includes('INV')) {
      return sameDigits(palMilhar, sorteioMilhar) || sameDigits(palCentena, sorteioCentena);
    }
    return palMilhar === sorteioMilhar || palCentena === sorteioCentena;
  }

  const palSegment = getSegmentForModal(key, palpite);
  const sorteioSegment = getSegmentForModal(key, sorteado);
  if (key.includes('INV')) return sameDigits(palSegment, sorteioSegment);
  return palSegment === sorteioSegment;
};

const getPermutationDivisor = (modal, palpite) => {
  const key = normalizeModal(modal);
  if (!key.includes('INV')) return 1;
  return countPermutations(getSegmentForModal(key, palpite));
};

const getTargetRange = (modal) => {
  const key = normalizeModal(modal);
  // Default: cabeça
  let indices = [0];
  let divisor = 1;

  if (key.includes('ESQ') || key.includes('MEIO') || key.includes('1/5') || key.includes('1 AO 5') || key.includes('1A5') || key.includes('3X') || key.includes('8/5')) {
    indices = [0, 1, 2, 3, 4];
    divisor = 5;
  }

  if (key.includes('10/6') || key.includes('SENA')) {
    indices = [0, 1, 2, 3, 4, 5];
    divisor = 6;
  }

  return { indices, divisor };
};

const checkVictory = ({ modal, palpites, premios }) => {
  const key = normalizeModal(modal);
  const { indices, divisor } = getTargetRange(key);
  const targets = premios.map((p) => normalizeMilhar(p));
  let matches = 0;
  let permutationsDiv = 1;
  let hit = false;

  // Numéricas simples
  if (key.includes('MILHAR') || key.includes('CENTENA') || key.includes('DEZENA') || key.includes('UNIDADE')) {
    let sliceSize = 4;
    if (key.includes('CENTENA')) sliceSize = 3;
    if (key.includes('DEZENA')) sliceSize = 2;
    if (key.includes('UNIDADE')) sliceSize = 1;
    const isInv = key.includes('INV');

    palpites.forEach((palp) => {
      const palStr = String(palp).padStart(4, '0').slice(-sliceSize);
      const permDiv = isInv ? countPermutations(palStr) : 1;
      permutationsDiv = Math.max(permutationsDiv, permDiv);
      indices.forEach((idx) => {
        const sorteado = targets[idx];
        if (!sorteado) return;
        const slice = sorteado.slice(-sliceSize);
        const win = isInv ? sameDigits(slice, palStr) : slice === palStr;
        if (win) {
          hit = true;
          matches += 1;
        }
      });
    });
  } else if (key.includes('GRUPO')) {
    const gruposSorteio = indices.map((idx) => getGrupo(targets[idx]));
    palpites.forEach((palp) => {
      const gPalp = Number(palp);
      const hitCount = gruposSorteio.filter((g) => g === gPalp).length;
      if (hitCount > 0) {
        hit = true;
        matches += hitCount;
      }
    });
  } else if (key.includes('DUQUE') || key.includes('TERNO') || key.includes('QUADRA') || key.includes('QUINA') || key.includes('SENA')) {
    const isGrupo = key.includes('GP') || key.includes('GRUPO');
    const sorteados = indices
      .map((idx) => {
        const num = targets[idx];
        if (!num) return null;
        if (isGrupo) return getGrupo(num);
        const dez = parseInt(num.slice(-2), 10);
        return Number.isNaN(dez) ? null : dez;
      })
      .filter((v) => v !== null);

    let required = 2;
    if (key.includes('TERNO')) required = 3;
    if (key.includes('QUADRA')) required = 4;
    if (key.includes('QUINA')) required = 5;
    if (key.includes('SENA')) required = 6;

    const hits = palpites.map((p) => Number(p)).filter((p) => sorteados.includes(p)).length;
    if (hits >= required) {
      hit = true;
      matches = 1;
      return { factor: 1, hit: true };
    }
    return { factor: 0, hit: false };
  } else if (key.includes('PASSE')) {
    const g1 = getGrupo(targets[0]);
    const g2 = getGrupo(targets[1]);
    const p1 = Number(palpites[0]);
    const p2 = Number(palpites[1]);
    if (key.includes('VAI VEM')) {
      const sorteados = [g1, g2];
      if (sorteados.includes(p1) && sorteados.includes(p2)) return { factor: 1, hit: true };
    } else if (g1 === p1 && g2 === p2) {
      return { factor: 1, hit: true };
    }
    return { factor: 0, hit: false };
  } else if (key.startsWith('QUININHA')) {
    const dezenasSorteadas = premios.slice(0, 5).map((n) => String(n).slice(-2).padStart(2, '0'));
    const palpitesUsuario = palpites.map((p) => String(p).padStart(2, '0'));
    const acertos = dezenasSorteadas.filter((d) => palpitesUsuario.includes(d)).length;
    if (acertos >= 5) {
      return { factor: 1, hit: true };
    }
    return { factor: 0, hit: false };
  } else if (key.startsWith('SENINHA')) {
    const dezenasSorteadas = premios.slice(0, 6).map((n) => String(n).slice(-2).padStart(2, '0'));
    const palpitesUsuario = palpites.map((p) => String(p).padStart(2, '0'));
    const acertos = dezenasSorteadas.filter((d) => palpitesUsuario.includes(d)).length;
    if (acertos >= 6) {
      return { factor: 1, hit: true };
    }
    return { factor: 0, hit: false };
  } else if (key.startsWith('SUPER15')) {
    const dezenasSorteadas = premios.slice(0, 15).map((n) => String(n).slice(-2).padStart(2, '0'));
    const palpitesUsuario = palpites.map((p) => String(p).padStart(2, '0'));
    const acertos = dezenasSorteadas.filter((d) => palpitesUsuario.includes(d)).length;
    if (acertos >= 15) {
      return { factor: 1, hit: true };
    }
    return { factor: 0, hit: false };
  }

  if (!hit) return { factor: 0, hit: false };
  const factor = (matches || 1) / (divisor * permutationsDiv || 1);
  return { factor, hit: true };
};

const parseApostasFromBet = (bet) => {
  let apostas = [];
  try {
    const parsed = typeof bet.palpites === 'string' ? JSON.parse(bet.palpites) : bet.palpites || [];
    if (Array.isArray(parsed)) apostas = parsed;
    else if (parsed && parsed.apostas) apostas = parsed.apostas;
  } catch {
    apostas = [];
  }

  if (Array.isArray(apostas) && apostas.length && apostas[0]?.palpites) {
    return apostas;
  }

  if (Array.isArray(apostas) && apostas.length) {
    return [
      {
        modalidade: bet.modalidade,
        colocacao: bet.colocacao,
        palpites: apostas,
        valorAposta: Number(bet.total || 0),
        modoValor: 'cada',
      },
    ];
  }

  return [];
};

const resolveUnitStake = (aposta, apostaCount, betTotal) => {
  const palpites = Array.isArray(aposta?.palpites) ? aposta.palpites : [];
  const qtd = palpites.length || 1;
  const valorBase = Number(aposta?.valorAposta ?? aposta?.valorPorNumero ?? aposta?.total ?? 0);
  const hasBase = !Number.isNaN(valorBase) && valorBase > 0;
  const fallbackPerAposta = apostaCount ? Number(betTotal || 0) / apostaCount : 0;
  const base = hasBase ? valorBase : fallbackPerAposta;
  const unit = aposta?.modoValor === 'cada' ? base : base / qtd;
  if (!Number.isFinite(unit) || unit <= 0) return 0;
  return unit;
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
      const apostas = parseApostasFromBet(bet);
      if (!apostas.length) {
        await prisma.bet.update({ where: { id: bet.id }, data: { status: 'nao premiado', settledAt: new Date(), resultId } });
        summary.processed += 1;
        continue;
      }

      let prize = 0;

      apostas.forEach((aposta) => {
        const modal = normalizeModal(aposta.modalidade || bet.modalidade);
        const payout = resolvePayout(modal);
        if (!payout) return;

        const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
        const unitStake = resolveUnitStake(aposta, apostas.length, bet.total);
        const { factor } = checkVictory({ modal, palpites, premios });

        if (factor > 0) {
          prize += unitStake * payout * factor;
        }
      });

      const finalPrize = Number(prize.toFixed(2));
      const modalDesc = normalizeModal(apostas[0]?.modalidade || bet.modalidade);
      const status = finalPrize > 0 ? 'won' : 'nao premiado';
      await prisma.$transaction(async (tx) => {
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            status,
            prize: finalPrize,
            settledAt: new Date(),
            resultId: resultId,
          },
        });

        if (finalPrize > 0) {
          await tx.user.update({
            where: { id: bet.userId },
            data: { balance: { increment: finalPrize } },
          });

          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: 'prize',
              amount: finalPrize,
              description: `Prêmio ${modalDesc} - ${result.loteria || ''} (${bet.id})`,
            },
          });
        }
      });

      summary.processed += 1;
      if (finalPrize > 0) summary.wins += 1;
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
    const [users, total, supervisors] = await prisma.$transaction([
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
          isAdmin: true,
        },
      }),
      prisma.user.count(),
      prisma.supervisor.findMany({ select: { id: true, phone: true, name: true, code: true } }),
    ]);

    const supPhones = new Set(
      supervisors
        .map((s) => String(s.phone || '').replace(/\D/g, ''))
        .filter(Boolean),
    );

    const enhancedUsers = users.map((u) => {
      const phoneClean = String(u.phone || '').replace(/\D/g, '');
      return {
        ...u,
        isSupervisor: supPhones.has(phoneClean),
      };
    });

    const hasMore = skip + users.length < total;
    return res.json({ users: enhancedUsers, supervisors, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
};

const generateSupervisorCode = (name, preferred = '') => {
  const base = preferred ? String(preferred).trim().toUpperCase() : '';
  const namePart = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const suffix = Math.floor(100 + Math.random() * 900);
  const sanitized = base.replace(/^99/, '') || namePart || 'SUP';
  return `99${sanitized}${suffix}`;
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
    const finalCode = generateSupervisorCode(name, code);

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
    const normalizer = getNormalizerForGame(loteria);
    const numerosNorm = numeros.map((n) => normalizer(n));
    let gruposFinal = [];
    const isLoteriaNumerica = (loteria || '').toUpperCase().match(/QUININHA|SENINHA|SUPER/);

    if (!isLoteriaNumerica) {
      try {
        gruposFinal = Array.isArray(grupos) ? grupos : JSON.parse(grupos || '[]');
      } catch {
        gruposFinal = [];
      }
      if (!gruposFinal.length || gruposFinal.length < numerosNorm.length) {
        gruposFinal = numerosNorm.map((n, idx) => {
          const provided = gruposFinal[idx];
          if (provided) return provided;
          const g = getGrupo(n);
          return g ? String(g).padStart(2, '0') : null;
        });
      }
    } else {
      gruposFinal = [];
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

exports.updateResult = async (req, res) => {
  const id = Number(req.params.id);
  const { loteria, codigoHorario, dataJogo, numeros, grupos } = req.body || {};
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  if (!loteria || !numeros || !Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: 'Informe loteria e lista de números/resultados.' });
  }

  try {
    const existing = await prisma.result.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Resultado não encontrado.' });

    const normalizer = getNormalizerForGame(loteria);
    const numerosNorm = numeros.map((n) => normalizer(n));
    let gruposFinal = [];
    const isLoteriaNumerica = (loteria || '').toUpperCase().match(/QUININHA|SENINHA|SUPER/);

    if (!isLoteriaNumerica) {
      try {
        gruposFinal = Array.isArray(grupos) ? grupos : JSON.parse(grupos || '[]');
      } catch {
        gruposFinal = [];
      }
      if (!gruposFinal.length || gruposFinal.length < numerosNorm.length) {
        gruposFinal = numerosNorm.map((n, idx) => {
          const provided = gruposFinal[idx];
          if (provided) return provided;
          const g = getGrupo(n);
          return g ? String(g).padStart(2, '0') : null;
        });
      }
    } else {
      gruposFinal = [];
    }

    const updated = await prisma.result.update({
      where: { id },
      data: {
        loteria,
        codigoHorario: codigoHorario || null,
        dataJogo: dataJogo || null,
        numeros: JSON.stringify(numerosNorm),
        grupos: gruposFinal.length ? JSON.stringify(gruposFinal) : null,
      },
    });

    return res.json({ result: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar resultado.' });
  }
};

exports.deleteResult = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const existing = await prisma.result.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Resultado não encontrado.' });

    await prisma.$transaction([
      prisma.bet.updateMany({ where: { resultId: id }, data: { resultId: null } }),
      prisma.resultPule.deleteMany({ where: { resultId: id } }),
      prisma.result.delete({ where: { id } }),
    ]);

    return res.json({ message: 'Resultado removido.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir resultado.' });
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

    // Evita processar pagamento duas vezes
    if (withdrawal.status === 'paid' && status === 'paid') {
      return res.json({ message: 'Já pago.' });
    }

    if (status === 'paid') {
      // Debita saldo e registra transação
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: withdrawal.userId }, select: { balance: true } });
        if (!user || Number(user.balance || 0) < Number(withdrawal.amount || 0)) {
          throw new Error('Saldo insuficiente para pagar o saque.');
        }
        await tx.user.update({
          where: { id: withdrawal.userId },
          data: { balance: { decrement: withdrawal.amount } },
        });
        await tx.transaction.create({
          data: {
            userId: withdrawal.userId,
            type: 'withdraw',
            amount: -Math.abs(withdrawal.amount),
            description: 'Saque pago (admin)',
          },
        });
        await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status } });
        return true;
      });
    } else {
      await prisma.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status } });
    }

    return res.json({ message: 'Status atualizado.' });
  } catch (err) {
    const msg = err.message || 'Erro ao atualizar saque.';
    return res.status(500).json({ error: msg });
  }
};

exports.createCoupon = async (req, res) => {
  const { code, description = '', type = 'fixed', amount, expiresAt, usageLimit, audience = 'all', active = true } = req.body || {};
  if (!code || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Informe código e valor do cupom.' });
  }
  if (!['fixed', 'percent'].includes(type)) {
    return res.status(400).json({ error: 'Tipo inválido. Use fixed ou percent.' });
  }
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: String(code).trim().toUpperCase(),
        description: description || null,
        type,
        amount: Number(amount),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        audience,
        active: Boolean(active),
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
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.coupon.count({ where }),
    ]);
    const hasMore = skip + items.length < total;
    return res.json({ coupons: items, page, pageSize, total, hasMore });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar cupons.' });
  }
};

exports.updateCoupon = async (req, res) => {
  const { id } = req.params;
  const { active, usageLimit } = req.body || {};
  const couponId = Number(id);
  if (!couponId || Number.isNaN(couponId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const data = {};
    if (typeof active !== 'undefined') data.active = Boolean(active);
    if (typeof usageLimit !== 'undefined') data.usageLimit = usageLimit === null ? null : Number(usageLimit);

    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data,
    });
    return res.json({ coupon: updated });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Cupom não encontrado.' });
    return res.status(500).json({ error: 'Erro ao atualizar cupom.' });
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

exports.updateUserRoles = async (req, res) => {
  const { id } = req.params;
  const userId = Number(id);
  if (!userId || Number.isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });

  const { isAdmin, makeSupervisor } = req.body || {};
  if (typeof isAdmin === 'undefined' && !makeSupervisor) {
    return res.status(400).json({ error: 'Nenhuma alteração informada.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    let supervisor = null;

    if (makeSupervisor) {
      const phoneClean = String(user.phone || '').replace(/\D/g, '');
      supervisor =
        (await prisma.supervisor.findFirst({
          where: {
            OR: [{ phone: phoneClean || null }, { name: user.name }],
          },
        })) ||
        (await prisma.supervisor.create({
          data: {
            name: user.name || `Supervisor ${user.id}`,
            phone: phoneClean || null,
            code: generateSupervisorCode(user.name),
          },
        }));
    }

    let updatedUser = user;
    if (typeof isAdmin === 'boolean') {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isAdmin },
        select: {
          id: true,
          name: true,
          phone: true,
          balance: true,
          bonus: true,
          createdAt: true,
          isAdmin: true,
        },
      });
    }

    return res.json({
      user: { ...updatedUser, isSupervisor: Boolean(supervisor) },
      supervisor,
      message: 'Usuário atualizado.',
    });
  } catch (err) {
    console.error('Erro ao atualizar papéis do usuário', err);
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
};
