// src/controllers/adminController.js
// VERSÃO RESTAURADA - COM APOSTAS, SAQUES E PULE

const prisma = require('../utils/prismaClient');

// --- FUNÇÕES AUXILIARES ---
const extractHour = (str) => {
  if (!str) return 'XX';
  const nums = String(str).replace(/\D/g, '');
  if (nums.length === 0) return 'XX';
  if (nums.length >= 3) return nums.slice(0, 2);
  return nums.padStart(2, '0');
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return 'INVALID';
  let clean = String(dateStr).split('T')[0].split(' ')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return clean;
};

const getLotteryKey = (name) => {
  return String(name || '').toUpperCase().replace('FEDERAL', '').replace('RIO', '').replace(/^LT/, '').replace(/[^A-Z0-9]/g, '');
};

const isFederal = (name) => String(name).toUpperCase().includes('FEDERAL');
const isMaluquinha = (name) => String(name).toUpperCase().includes('MALUQ');

// --- HELPERS DE APOSTA ---
function parseApostasFromBet(bet) {
  try {
    if (typeof bet.palpites === 'string') return JSON.parse(bet.palpites);
    if (Array.isArray(bet.palpites)) return bet.palpites;
    return []; 
  } catch { return []; }
}

function resolvePayout(modalidade) {
  const table = {
    'MILHAR': 4000, 'CENTENA': 400, 'DEZENA': 60, 'GRUPO': 18,
    'DUQUE DEZENA': 300, 'TERNO DEZENA': 3000, 'DUQUE GRUPO': 18, 'TERNO GRUPO': 150
  };
  const key = String(modalidade).toUpperCase();
  for (const k in table) if (key.includes(k)) return table[k];
  return 0;
}

function checkVictory({ modal, palpites, premios }) {
  let factor = 0;
  const m = String(modal).toUpperCase();
  const cleanPalpites = palpites.map(p => String(p).replace(/\D/g, ''));
  if (m.includes('MILHAR')) {
    if (cleanPalpites.includes(premios[0])) factor += 1;
  } else if (m.includes('CENTENA')) {
    const centenasPremios = premios.map(p => p.slice(-3));
    if (cleanPalpites.includes(centenasPremios[0])) factor += 1;
  } else if (m.includes('GRUPO')) {
    const getGrp = (n) => {
      const d = parseInt(n.slice(-2));
      if (d === 0) return '25';
      return String(Math.ceil(d / 4));
    };
    const gruposPremios = premios.map(getGrp);
    if (cleanPalpites.includes(gruposPremios[0])) factor += 1;
  }
  return { factor };
}

// ==========================================
// CONTROLLERS
// ==========================================

// 1. DASHBOARD
exports.getDashboardStats = async (req, res) => {
  try {
    const [usersAgg, betsAgg, withdrawalsAgg, betsCount] = await Promise.all([
      prisma.user.aggregate({ _sum: { balance: true, bonus: true } }),
      prisma.bet.aggregate({ _sum: { total: true } }),
      prisma.withdrawalRequest.aggregate({
        where: { status: { in: ['pending', 'approved'] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.bet.count(),
    ]);

    const totalUsers = await prisma.user.count();
    const totalBalance = Number(usersAgg._sum.balance || 0);
    const totalBonus = Number(usersAgg._sum.bonus || 0);
    const totalBetsVolume = Number(betsAgg._sum.total || 0);

    const pendingWithdrawals = {
      amount: Number(withdrawalsAgg._sum.amount || 0),
      count: withdrawalsAgg._count?._all || 0,
    };

    res.json({
      totalUsers,
      betsCount,
      platformFunds: totalBetsVolume,
      moneyOut: { bets: totalBetsVolume },
      wallets: {
        saldo: totalBalance,
        bonus: totalBonus,
        total: totalBalance + totalBonus,
      },
      pendingWithdrawals,
    });
  } catch (error) {
    console.error('Erro dashboard:', error);
    res.json({
      totalUsers: 0,
      betsCount: 0,
      platformFunds: 0,
      moneyOut: { bets: 0 },
      wallets: { saldo: 0, bonus: 0, total: 0 },
      pendingWithdrawals: { amount: 0, count: 0 },
    });
  }
};

// 2. USUÁRIOS
exports.listUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 50;
    const users = await prisma.user.findMany({ 
      take: pageSize, 
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' }, 
      select: { id: true, name: true, phone: true, balance: true, cpf: true, isAdmin: true, email: true } 
    });
    const total = await prisma.user.count();
    res.json({ users, total, page });
  } catch(e) { 
    console.error(e);
    res.status(500).json({error: 'Erro list users'}); 
  }
};

exports.toggleUserBlock = async (req, res) => {
  // Desativado temporariamente
  return res.json({ message: "Funcionalidade desativada temporariamente." });
};

// 3. APOSTAS (LISTAR) - RESTAURADO
exports.listBets = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 50;
    const bets = await prisma.bet.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, phone: true } } }
    });
    const total = await prisma.bet.count();
    res.json({ bets, total, page });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar apostas.' });
  }
};

// 4. SAQUES (LISTAR) - RESTAURADO
exports.listWithdrawals = async (req, res) => {
  try {
    try {
      const withdrawals = await prisma.withdrawal.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, phone: true, pixKey: true } } }
      });
      res.json({ withdrawals });
    } catch (e) {
      console.warn('Tabela Withdrawal não encontrada ou erro:', e.message);
      res.json({ withdrawals: [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar saques.' });
  }
};

// 5. SUPERVISORES (RESTAURADO)
exports.listSupervisors = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 50;
    const supervisors = await prisma.supervisor.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      include: { users: { select: { id: true, name: true, phone: true } } },
    });
    const total = await prisma.supervisor.count();
    res.json({ supervisors, total, page });
  } catch (error) {
    console.error('Erro listSupervisors:', error);
    res.json({ supervisors: [], total: 0, page: 1 });
  }
};

// 6. RESULTADOS (CRUD)
exports.createResult = async (req, res) => {
  try {
    const { loteria, dataJogo, codigoHorario, numeros, grupos } = req.body;
    const result = await prisma.result.create({
      data: { loteria, dataJogo, codigoHorario, numeros, grupos: grupos || [] },
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar resultado.' });
  }
};

exports.listResults = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const results = await prisma.result.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await prisma.result.count();
    res.json({ results, total, page, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar resultados.' });
  }
};

exports.updateResult = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.result.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar resultado.' });
  }
};

exports.deleteResult = async (req, res) => {
  try {
    await prisma.result.delete({ where: { id: req.params.id } });
    res.json({ message: 'Resultado deletado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
};

// 7. GERAR PULE (CUPOM) - RESTAURADO
exports.generatePule = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });
    res.json({ message: 'Pule gerado com sucesso.', alreadyExists: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar pule.' });
  }
};

// 8. LIQUIDAÇÃO
exports.settleBetsForResult = async (req, res) => {
  const { id } = req.params;
  console.log(`\n🚀 [V8-FULL] LIQUIDANDO RESULTADO ID: ${id}`);
  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    const resDate = normalizeDate(result.dataJogo);
    const resHour = extractHour(result.codigoHorario);
    const resIsFed = isFederal(result.loteria);
    const resIsMaluq = isMaluquinha(result.loteria);
    const resKey = getLotteryKey(result.loteria); 

    console.log(`📊 GABARITO: Data=[${resDate}] Hora=[${resHour}] Tipo=[${resIsFed ? 'FED' : resIsMaluq ? 'MALUQ' : resKey}] String=[${result.loteria}]`);

    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros);
    } catch { numerosSorteados = []; }
    const premios = numerosSorteados.map(n => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'));

    const bets = await prisma.bet.findMany({ where: { status: 'open' }, include: { user: true } });
    console.log(`🔎 Analisando ${bets.length} apostas abertas...`);
    const summary = { totalBets: 0, processed: 0, wins: 0, errors: [] };

    for (const bet of bets) {
      try {
        const betDate = normalizeDate(bet.dataJogo);
        const betHour = extractHour(bet.codigoHorario);
        if (betDate !== resDate) continue;
        if (betHour !== resHour) continue; 

        const betIsFed = isFederal(bet.loteria);
        const betIsMaluq = isMaluquinha(bet.loteria);
        const betKey = getLotteryKey(bet.loteria);
        let match = false;

        if (resIsFed) { if (betIsFed) match = true; } 
        else if (resIsMaluq) { if (betIsMaluq) match = true; } 
        else {
          if (betKey && resKey && (betKey === resKey || betKey.includes(resKey) || resKey.includes(betKey))) match = true;
          if (!match && (result.loteria.includes(bet.loteria) || bet.loteria.includes(result.loteria))) match = true;
        }

        if (!match) continue;
        console.log(`✅ MATCH! Aposta #${bet.id}`);
        summary.totalBets++;

        const apostas = parseApostasFromBet(bet);
        if (!apostas || !apostas.length) {
           await prisma.bet.update({ where: { id: bet.id }, data: { status: 'nao premiado', settledAt: new Date(), resultId: id } });
           summary.processed++;
           continue;
        }

        let prize = 0;
        apostas.forEach((aposta) => {
          const modal = aposta.modalidade || bet.modalidade;
          const payout = resolvePayout(modal);
          if (payout > 0) {
              const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
              const totalPalpitesNaBet = apostas.reduce((acc, curr) => acc + (curr.palpites?.length || 0), 0);
              const unitStake = bet.total / (totalPalpitesNaBet > 0 ? totalPalpitesNaBet : 1);
              const { factor } = checkVictory({ modal, palpites, premios });
              if (factor > 0) prize += unitStake * payout * factor;
          }
        });

        const finalPrize = Number(prize.toFixed(2));
        const status = finalPrize > 0 ? 'won' : 'nao premiado';

        await prisma.$transaction(async (tx) => {
          await tx.bet.update({ where: { id: bet.id }, data: { status, prize: finalPrize, settledAt: new Date(), resultId: id } });
          if (finalPrize > 0) {
            await tx.user.update({ where: { id: bet.userId }, data: { balance: { increment: finalPrize } } });
            await tx.transaction.create({ data: { userId: bet.userId, type: 'prize', amount: finalPrize, description: `Prêmio ${bet.modalidade} (${bet.id})` } });
          }
        });

        summary.processed++;
        if (finalPrize > 0) summary.wins++;
      } catch (innerErr) {
        summary.errors.push({ id: bet.id, msg: innerErr.message });
      }
    }
    res.json({ message: 'Processamento concluído', summary });
  } catch (err) {
    console.error('Erro fatal:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
};

// --- ALIASES (GARANTINDO QUE TUDO EXISTA) ---
exports.getStats = exports.getDashboardStats;
exports.getDashboard = exports.getDashboardStats;
exports.getUsers = exports.listUsers;
exports.getBets = exports.listBets; // Alias para Apostas
exports.getWithdrawals = exports.listWithdrawals; // Alias para Saques
exports.getResults = exports.listResults;
exports.getSupervisors = exports.listSupervisors;
