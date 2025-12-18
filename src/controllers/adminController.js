// src/controllers/adminController.js
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

// --- CONTROLLERS ---

const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalBets = await prisma.bet.count();
    let totalBalance = 0;
    try {
        const ag = await prisma.user.aggregate({ _sum: { balance: true } });
        totalBalance = ag._sum.balance || 0;
    } catch(e) {}
    res.json({ totalUsers, totalBets, totalBalance, netProfit: 0 });
  } catch (error) {
    console.error('Erro dashboard:', error);
    res.json({ totalUsers: 0, totalBets: 0, totalBalance: 0 });
  }
};

const listUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 50;
    const users = await prisma.user.findMany({ 
      take: pageSize, 
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' }, 
      select: { id: true, name: true, phone: true, balance: true, cpf: true, isAdmin: true, isBlocked: true, email: true } 
    });
    const total = await prisma.user.count();
    res.json({ users, total, page });
  } catch(e) { 
    console.error(e);
    res.status(500).json({error: 'Erro list users'}); 
  }
};

const toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const updated = await prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar status.' });
  }
};

const listSupervisors = async (req, res) => {
  return res.json([]);
};

const createResult = async (req, res) => {
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

const listResults = async (req, res) => {
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

const updateResult = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.result.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar resultado.' });
  }
};

const deleteResult = async (req, res) => {
  try {
    await prisma.result.delete({ where: { id: req.params.id } });
    res.json({ message: 'Resultado deletado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
};

const settleBetsForResult = async (req, res) => {
  const { id } = req.params;
  console.log(`\n🚀 [V7-FINAL] LIQUIDANDO RESULTADO ID: ${id}`);
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

// --- EXPORTAÇÃO UNIFICADA (AQUI É O SEGREDO) ---
module.exports = {
  getDashboardStats,
  listUsers,
  toggleUserBlock,
  listSupervisors,
  createResult,
  listResults,
  updateResult,
  deleteResult,
  settleBetsForResult,
  // Aliases para evitar erros de rota
  getStats: getDashboardStats,
  getDashboard: getDashboardStats,
  getUsers: listUsers,
  getResults: listResults,
  getSupervisors: listSupervisors
};
