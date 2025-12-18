// src/controllers/adminController.js
// Importamos a conexão já configurada do seu projeto
const prisma = require('../utils/prismaClient');

// --- FUNÇÕES AUXILIARES DE LIMPEZA ---
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
  return String(name || '')
    .toUpperCase()
    .replace('FEDERAL', '')
    .replace('RIO', '')
    .replace(/^LT/, '')
    .replace(/[^A-Z0-9]/g, '');
};

const isFederal = (name) => String(name).toUpperCase().includes('FEDERAL');
const isMaluquinha = (name) => String(name).toUpperCase().includes('MALUQ');

// --- CONTROLLERS FALTANTES (CAUSA DO ERRO) ---

// 1. DASHBOARD (Estatísticas Gerais)
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalBets = await prisma.bet.count();
    
    // Soma de depósitos e saques (se houver tabelas)
    // Aqui fazemos um básico para não quebrar
    const users = await prisma.user.findMany({ select: { balance: true } });
    const totalBalance = users.reduce((acc, u) => acc + Number(u.balance), 0);

    res.json({
      totalUsers,
      totalBets,
      totalBalance,
      netProfit: 0 // Placeholder
    });
  } catch (error) {
    console.error('Erro dashboard:', error);
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
};
// Alias para rotas antigas
exports.stats = exports.getDashboardStats;

// 2. BLOQUEAR/DESBLOQUEAR USUÁRIO
exports.toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const updated = await prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked } // Supondo que exista isBlocked
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar status.' });
  }
};

// --- CONTROLLERS DE RESULTADOS (PRINCIPAIS) ---

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

// --- CONTROLLERS DE USUÁRIO ---

exports.listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ 
      take: 50, 
      orderBy: { createdAt: 'desc' }, 
      select: { id: true, name: true, phone: true, balance: true, cpf: true, isAdmin: true } 
    });
    res.json({ users, total: users.length });
  } catch(e) { 
    res.status(500).json({error: 'Erro list users'}); 
  }
};

// --- FUNÇÃO FALTANTE: LISTAR SUPERVISORES ---
const listSupervisors = async (req, res) => {
  try {
    try {
      const sups = await prisma.supervisor.findMany();
      return res.json(sups);
    } catch {
      return res.json([]);
    }
  } catch (error) {
    console.error('Erro listSupervisors:', error);
    return res.json([]);
  }
};
exports.listSupervisors = listSupervisors;

// --- STUBS LEGADOS (para rotas existentes não implementadas nesta versão) ---
const notImplemented = (feature) => async (req, res) => res.status(501).json({ error: `${feature} não implementado neste build.` });

exports.listBets = notImplemented('listBets');
exports.updateUserRoles = notImplemented('updateUserRoles');
exports.deleteUser = notImplemented('deleteUser');
exports.createSupervisor = notImplemented('createSupervisor');
exports.updateSupervisor = notImplemented('updateSupervisor');
exports.deleteSupervisor = notImplemented('deleteSupervisor');
exports.generateResultPule = notImplemented('generateResultPule');
exports.listWithdrawals = notImplemented('listWithdrawals');
exports.updateWithdrawalStatus = notImplemented('updateWithdrawalStatus');
exports.createCoupon = notImplemented('createCoupon');
exports.listCoupons = notImplemented('listCoupons');
exports.updateCoupon = notImplemented('updateCoupon');
exports.manualCreditPix = notImplemented('manualCreditPix');

// --- LIQUIDAÇÃO (SHERLOCK HOLMES V4-FIX) ---
exports.settleBetsForResult = async (req, res) => {
  const { id } = req.params;
  console.log(`\n🚀 [V4-FIX] INICIANDO LIQUIDAÇÃO DO RESULTADO ID: ${id}`);

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    // 1. Dados do GABARITO
    const resDate = normalizeDate(result.dataJogo);
    const resHour = extractHour(result.codigoHorario);
    const resIsFed = isFederal(result.loteria);
    const resIsMaluq = isMaluquinha(result.loteria);
    const resKey = getLotteryKey(result.loteria); 

    console.log(`📊 GABARITO: Data=[${resDate}] Hora=[${resHour}] Tipo=[${resIsFed ? 'FED' : resIsMaluq ? 'MALUQ' : resKey}] String=[${result.loteria}]`);

    // Prepara números
    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros);
    } catch { numerosSorteados = []; }
    const premios = numerosSorteados.map(n => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'));

    // 2. Busca Apostas
    const bets = await prisma.bet.findMany({
      where: { status: 'open' },
      include: { user: true }
    });

    console.log(`🔎 Analisando ${bets.length} apostas abertas...`);
    const summary = { totalBets: 0, processed: 0, wins: 0, errors: [] };

    for (const bet of bets) {
      try {
        const betDate = normalizeDate(bet.dataJogo);
        const betHour = extractHour(bet.codigoHorario);

        if (betDate !== resDate) continue;
        if (betHour !== resHour) continue; 

        // Filtro LOTERIA
        const betIsFed = isFederal(bet.loteria);
        const betIsMaluq = isMaluquinha(bet.loteria);
        const betKey = getLotteryKey(bet.loteria);

        let match = false;
        if (resIsFed) {
          if (betIsFed) match = true;
        } else if (resIsMaluq) {
          if (betIsMaluq) match = true;
        } else {
          if (betKey && resKey && (betKey === resKey || betKey.includes(resKey) || resKey.includes(betKey))) {
            match = true;
          }
          if (!match && (result.loteria.includes(bet.loteria) || bet.loteria.includes(result.loteria))) {
            match = true;
          }
        }

        if (!match) continue;

        console.log(`✅ MATCH! Aposta #${bet.id} (User ${bet.userId})`);
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
          if (!payout) return;

          const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
          const totalPalpitesNaBet = apostas.reduce((acc, curr) => acc + (curr.palpites?.length || 0), 0);
          const unitStake = bet.total / (totalPalpitesNaBet > 0 ? totalPalpitesNaBet : 1);
          
          const { factor } = checkVictory({ modal, palpites, premios });

          if (factor > 0) {
            const winVal = unitStake * payout * factor;
            prize += winVal;
            console.log(`      💰 GANHOU! ${modal} | Prêmio: ${winVal.toFixed(2)}`);
          }
        });

        const finalPrize = Number(prize.toFixed(2));
        const status = finalPrize > 0 ? 'won' : 'nao premiado';

        await prisma.$transaction(async (tx) => {
          await tx.bet.update({
            where: { id: bet.id },
            data: { status, prize: finalPrize, settledAt: new Date(), resultId: id },
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
                description: `Prêmio ${bet.modalidade} (${bet.id})`,
              },
            });
          }
        });

        summary.processed++;
        if (finalPrize > 0) summary.wins++;

      } catch (innerErr) {
        console.error(`❌ Erro Bet ${bet.id}:`, innerErr);
        summary.errors.push({ id: bet.id, msg: innerErr.message });
      }
    }

    console.log('🏁 FIM DA LIQUIDAÇÃO:', summary);
    res.json({ message: 'Processamento concluído', summary });

  } catch (err) {
    console.error('Erro fatal:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
};

// --- HELPERS ---
function parseApostasFromBet(bet) {
  try {
    if (typeof bet.palpites === 'string') return JSON.parse(bet.palpites);
    if (Array.isArray(bet.palpites)) return bet.palpites;
    return []; 
  } catch { return []; }
}

// Alias que depende da definição de settleBetsForResult
exports.settleResult = exports.settleBetsForResult;

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
  }
  else if (m.includes('CENTENA')) {
    const centenasPremios = premios.map(p => p.slice(-3));
    if (cleanPalpites.includes(centenasPremios[0])) factor += 1;
  }
  else if (m.includes('GRUPO')) {
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

module.exports = {
  getDashboardStats,
  stats: getDashboardStats,
  getStats: getDashboardStats,
  getDashboard: getDashboardStats,
  toggleUserBlock,
  createResult,
  listResults,
  getResults: listResults,
  updateResult,
  deleteResult,
  settleBetsForResult,
  settleResult: exports.settleResult,
  listUsers,
  getUsers: listUsers,
  listSupervisors,
  getSupervisors: listSupervisors,
  listBets,
  updateUserRoles,
  deleteUser,
  createSupervisor,
  updateSupervisor,
  deleteSupervisor,
  generateResultPule,
  listWithdrawals,
  updateWithdrawalStatus,
  createCoupon,
  listCoupons,
  updateCoupon,
  manualCreditPix,
};
