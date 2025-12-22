// src/controllers/adminController.js
// VERSÃO V18 - Chaves seguras + datas flexíveis + colocação/payout + mapeamento direto de grupo

const prisma = require('../utils/prismaClient');

// Mapeamento fixo de grupo -> bicho (jogo do bicho)
const BICHOS_NOME = {
  1: 'Avestruz', 2: 'Águia', 3: 'Burro', 4: 'Borboleta', 5: 'Cachorro',
  6: 'Cabra', 7: 'Carneiro', 8: 'Camelo', 9: 'Cobra', 10: 'Coelho',
  11: 'Cavalo', 12: 'Elefante', 13: 'Galo', 14: 'Gato', 15: 'Jacaré',
  16: 'Leão', 17: 'Macaco', 18: 'Porco', 19: 'Pavão', 20: 'Peru',
  21: 'Touro', 22: 'Tigre', 23: 'Urso', 24: 'Veado', 25: 'Vaca',
};

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
  return String(name || '')
    .toUpperCase()
    .replace('FEDERAL', '')
    .replace(/^LT\s*/, '')
    .replace(/[^A-Z0-9]/g, '');
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

// NOVO: Converte número (milhar ou dezena) para Grupo (1-25) usando a dezena final
function getGrupoFromNumber(number) {
  const str = String(number).padStart(2, '0');
  const dezenaStr = str.slice(-2); // pega exatamente os dois últimos dígitos
  const dezena = parseInt(dezenaStr, 10);
  if (Number.isNaN(dezena)) return null;
  if (dezena === 0) return '25'; // Vaca (00)
  return String(Math.ceil(dezena / 4));
}

const getNomeBicho = (grupo) => BICHOS_NOME[parseInt(grupo, 10)] || 'Desconhecido';

// NOVO: Determina índices de prêmio baseado na colocação (String do banco)
function getPrizeIndices(colocacao) {
  const c = String(colocacao || '').toUpperCase();

  if (c.includes('1/5') || c.includes('1 AO 5')) return [0, 1, 2, 3, 4];
  if (c.includes('1/4')) return [0, 1, 2, 3];
  if (c.includes('1/3')) return [0, 1, 2];
  if (c.includes('1/2')) return [0, 1];

  // Padrão: Apenas o 1º prêmio (Cabeça)
  return [0];
}

// ATUALIZADO V12: Verifica vitória considerando colocação e modalidades compostas
function checkVictory({ modal, colocacao, palpites, premios }) {
  const m = String(modal).toUpperCase();
  const cleanPalpites = palpites.map(p => String(p).replace(/\D/g, ''));
  const indicesToCheck = getPrizeIndices(colocacao);

  // Extrai somente os valores relevantes ao modal (milhar/centena/dezena/grupo) nas posições válidas
  const drawnItems = [];
  for (const index of indicesToCheck) {
    if (!premios[index]) continue;

    const premioRaw = String(premios[index]);
    const premioMilhar = premioRaw.slice(-4).padStart(4, '0');
    const premioCentena = premioRaw.slice(-3).padStart(3, '0');
    const premioDezena = premioRaw.slice(-2).padStart(2, '0');
    const premioGrupo = getGrupoFromNumber(premioDezena);

    if (m.includes('MILHAR')) drawnItems.push(premioMilhar);
    else if (m.includes('CENTENA')) drawnItems.push(premioCentena);
    else if (m.includes('GRUPO') || m.includes('GP')) drawnItems.push(premioGrupo);
    else if (m.includes('DEZENA') || m.includes('DEZ')) drawnItems.push(premioDezena);
  }

  // Lógica para apostas compostas (Duque/Terno/Quadra/Quina)
  if (m.includes('DUQUE') || m.includes('TERNO') || m.includes('QUADRA') || m.includes('QUINA')) {
    const uniqueDrawn = new Set(drawnItems);
    let matchCount = 0;

    for (const p of cleanPalpites) {
      if (uniqueDrawn.has(p)) matchCount++;
    }

    let required = 99;
    if (m.includes('DUQUE')) required = 2;
    else if (m.includes('TERNO')) required = 3;
    else if (m.includes('QUADRA')) required = 4;
    else if (m.includes('QUINA')) required = 5;

    const factor = matchCount >= required ? 1 : 0;
    // Pagamentos dessas modalidades já consideram 1º ao 5º; não dividir pelo número de posições.
    return { factor, checkedCount: 1 };
  }

  // Lógica para apostas simples (milhar, centena, dezena, grupo)
  let hits = 0;
  for (const item of drawnItems) {
    if (cleanPalpites.includes(item)) hits++;
  }

  return { factor: hits, checkedCount: indicesToCheck.length };
}

// ==========================================
// CONTROLLERS
// ==========================================

// 1. DASHBOARD
exports.getDashboardStats = async (req, res) => {
  try {
    const [usersAgg, betsAgg, withdrawalsAgg, betsCount, totalUsers] = await Promise.all([
      prisma.user.aggregate({ _sum: { balance: true, bonus: true } }),
      prisma.bet.aggregate({ _sum: { total: true } }),
      prisma.withdrawalRequest.aggregate({
        where: { status: { in: ['pending', 'approved'] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.bet.count(),
      prisma.user.count(),
    ]);

    const totalBalance = Number(usersAgg._sum.balance || 0);
    const totalBonus = Number(usersAgg._sum.bonus || 0);
    const platformFunds = Number(betsAgg._sum.total || 0);
    const pendingWithdrawals = {
      amount: Number(withdrawalsAgg._sum.amount || 0),
      count: withdrawalsAgg._count?._all || 0,
    };

    res.json({
      totalUsers,
      betsCount,
      platformFunds,
      moneyOut: { bets: platformFunds },
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
  return res.json({ message: "Funcionalidade desativada temporariamente." });
};

// 3. APOSTAS
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

// 4. SAQUES
exports.listWithdrawals = async (req, res) => {
  try {
    try {
      const withdrawals = await prisma.withdrawal.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, phone: true, pixKey: true } } }
      });
      res.json({ withdrawals });
    } catch (e) {
      console.warn('Tabela Withdrawal não encontrada:', e.message);
      res.json({ withdrawals: [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar saques.' });
  }
};

// 5. SUPERVISORES
exports.listSupervisors = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = 50;
    const supervisors = await prisma.supervisor.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { users: { select: { id: true, name: true, phone: true } } },
    });
    const total = await prisma.supervisor.count();
    res.json({ supervisors, total, page });
  } catch (error) {
    console.warn('Tabela Supervisor não encontrada:', error.message);
    res.json({ supervisors: [], total: 0, page: 1 });
  }
};

// 6. RESULTADOS (CRUD) - CORREÇÃO JSON.STRINGIFY
exports.createResult = async (req, res) => {
  try {
    const { loteria, dataJogo, codigoHorario, numeros, grupos } = req.body;
    let numerosArray = [];
    if (Array.isArray(numeros)) numerosArray = numeros;
    else if (typeof numeros === 'string') {
      try { numerosArray = JSON.parse(numeros); } catch { numerosArray = []; }
    }

    let gruposArray = [];
    if (Array.isArray(grupos) && grupos.length) {
      gruposArray = grupos;
    } else {
      gruposArray = numerosArray
        .map((milhar) => {
          const dezena = String(milhar).padStart(4, '0').slice(-2);
          return getGrupoFromNumber(dezena);
        })
        .filter(Boolean);
    }

    const numerosString = JSON.stringify(numerosArray);
    const gruposString = JSON.stringify(gruposArray);

    const result = await prisma.result.create({
      data: { 
        loteria, 
        dataJogo, 
        codigoHorario, 
        numeros: numerosString, 
        grupos: gruposString || '[]' 
      },
    });

    // Auto-liquidação após cadastrar resultado (sem mudar o contrato do endpoint)
    try {
      await settleBetsForResultId(result.id);
    } catch (e) {
      console.error('⚠️ Auto-liquidação falhou:', e?.message || e);
    }

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
    const id = Number(req.params.id);
    const { numeros, grupos, ...rest } = req.body;
    const dataToUpdate = { ...rest };
    if (numeros) dataToUpdate.numeros = Array.isArray(numeros) ? JSON.stringify(numeros) : numeros;
    if (grupos) dataToUpdate.grupos = Array.isArray(grupos) ? JSON.stringify(grupos) : grupos;

    const updated = await prisma.result.update({ where: { id }, data: dataToUpdate });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar resultado.' });
  }
};

exports.deleteResult = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.result.delete({ where: { id } });
    res.json({ message: 'Resultado deletado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
};

// 7. GERAR PULE
exports.generatePule = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });
    res.json({ message: 'Pule gerado com sucesso.', alreadyExists: false });
  } catch (error) {
    console.error('Erro Pule:', error);
    res.status(500).json({ error: 'Erro ao gerar pule.' });
  }
};

// 8. LIQUIDAÇÃO (V16 - chaves seguras, datas flexíveis, logs)
/**
 * Liquida todas as apostas abertas compatíveis com um resultado.
 * Retorna um summary (na prática idempotente, pois só processa status='open').
 */
async function settleBetsForResultId(id) {
  console.log(`\n🚀 [V18-DIRETO] LIQUIDANDO RESULTADO ID: ${id}`);

  const result = await prisma.result.findUnique({ where: { id } });
  if (!result) throw new Error('Resultado não encontrado');

  const resDateISO = normalizeDate(result.dataJogo);
  const resDateOriginal = result.dataJogo;
  const datesToSearch = [resDateISO, resDateOriginal].filter((d, i, self) => d && self.indexOf(d) === i);
  const resHour = extractHour(result.codigoHorario);
  const resKey = getLotteryKey(result.loteria);

  console.log(`🔎 FILTRO: Data [${datesToSearch.join(', ')}] | Hora [${resHour}] | Chave [${resKey}]`);

  // Log de conferência das milhares -> dezena -> grupo
  try {
    const nums = typeof result.numeros === 'string' ? JSON.parse(result.numeros) : result.numeros;
    console.log('🎲 SORTEIO (Milhar -> Dezena -> Grupo/Bicho):');
    if (Array.isArray(nums)) {
      nums.forEach((milhar, idx) => {
        const milharStr = String(milhar).padStart(4, '0');
        const dezena = milharStr.slice(-2);
        const grp = getGrupoFromNumber(dezena);
        const bicho = getNomeBicho(grp);
        console.log(`   ${idx + 1}º: ${milharStr} => Dezena ${dezena} => Grupo ${grp} (${bicho})`);
      });
    }
  } catch (e) {
    console.warn('Não foi possível logar grupos do resultado:', e?.message || e);
  }

  const bets = await prisma.bet.findMany({
    where: {
      status: 'open',
      dataJogo: { in: datesToSearch },
      codigoHorario: { contains: resHour },
    },
  });

  console.log(`📦 APOSTAS CANDIDATAS (Data/Hora): ${bets.length}`);

  const summary = { totalBets: 0, processed: 0, wins: 0, errors: [] };

  for (const bet of bets) {
    const betKey = getLotteryKey(bet.loteria);
    const resIsFed = String(result.loteria).toUpperCase().includes('FEDERAL');
    const betIsFed = String(bet.loteria).toUpperCase().includes('FEDERAL');
    const resIsMal = String(result.loteria).toUpperCase().includes('MALUQ');
    const betIsMal = String(bet.loteria).toUpperCase().includes('MALUQ');

    let match = false;

    if (resIsFed) match = betIsFed;
    else if (resIsMal) match = betIsMal;
    else {
      if (betKey && resKey && (betKey === resKey || betKey.includes(resKey) || resKey.includes(betKey))) match = true;
      if (!match && (String(result.loteria).includes(String(bet.loteria)) || String(bet.loteria).includes(String(result.loteria)))) match = true;
    }

    if (!match) {
      console.log(`❌ IGNORADA #${bet.id}: ${bet.loteria} (Key: ${betKey}) != ${result.loteria}`);
      continue;
    }

    summary.totalBets++;

    try {
      const apostas = parseApostasFromBet(bet);
      if (!apostas || !apostas.length) {
        await prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'nao premiado', settledAt: new Date(), resultId: id, prize: 0 },
        });
        summary.processed++;
        continue;
      }

      let premios = [];
      try {
        const n = typeof result.numeros === 'string' ? JSON.parse(result.numeros) : result.numeros;
        if (Array.isArray(n)) premios = n.map(x => String(x).replace(/\D/g, '')).filter(Boolean);
      } catch { premios = []; }

      const victory = checkVictory({
        modal: bet.modalidade,
        colocacao: bet.colocacao,
        palpites: apostas,
        premios,
      });

      let finalPrize = 0;
      if (victory?.factor > 0) {
        const payoutBase = resolvePayout(bet.modalidade);
        const betValue = Number(bet.valor || bet.total || 0);
        const divisor = victory.checkedCount > 0 ? victory.checkedCount : 1;

        finalPrize = (betValue * payoutBase * victory.factor) / divisor;
        finalPrize = Math.round((finalPrize + Number.EPSILON) * 100) / 100;
        console.log(`✅ GANHOU #${bet.id}: R$ ${finalPrize} (Fator: ${victory.factor})`);
      }

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
      console.error(`Erro #${bet.id}:`, innerErr);
      summary.errors.push({ id: bet.id, msg: innerErr.message });
    }
  }

  console.log('🏁 FIM. Resumo:', summary);
  return summary;
}

exports.settleBetsForResult = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const summary = await settleBetsForResultId(id);
    return res.json({ message: 'Processamento concluído', summary });
  } catch (err) {
    console.error('❌ Erro ao liquidar:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Erro ao liquidar apostas.' });
  }
};

// --- ALIASES ---
exports.getStats = exports.getDashboardStats;
exports.getDashboard = exports.getDashboardStats;
exports.getUsers = exports.listUsers;
exports.getBets = exports.listBets;
exports.getWithdrawals = exports.listWithdrawals;
exports.getResults = exports.listResults;
exports.getSupervisors = exports.listSupervisors;

// 9. DEBUG: ENCONTRAR APOSTAS SEM NOME DE LOTERIA
async function debugOrphanedBets(req, res) {
  try {
    console.log('🔍 Buscando apostas sem nome de loteria...');
    const bets = await prisma.bet.findMany({
      where: {
        OR: [{ loteria: null }, { loteria: '' }],
      },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const result = bets.map((b) => ({
      id: b.id,
      criadoEm: b.createdAt,
      horaNoBanco: b.codigoHorario,
      dataJogo: b.dataJogo,
      usuario: b.user?.name,
      telefone: b.user?.phone,
      palpites: b.palpites,
    }));

    return res.json({
      count: result.length,
      bets: result,
      dica: "Se 'horaNoBanco' tiver apenas a hora (ex: 14:00), consulte o usuário pelo telefone.",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

exports.debugOrphanedBets = debugOrphanedBets;

// 10. DEBUG: TENTAR RECUPERAR LOTERIA A PARTIR DO codigoHorario
function extractLoteriaFromCodigo(codigoHorario) {
  if (!codigoHorario) return null;
  const raw = String(codigoHorario).trim();
  // Usa tudo antes do primeiro dígito como possível nome (ex: "LT PT RIO 14HS" -> "LT PT RIO")
  const match = raw.match(/^([^\d]+)/);
  if (!match) return null;
  const nome = match[1].trim();
  return nome.length ? nome : null;
}

async function repairOrphanedBets(req, res) {
  try {
    console.log('🛠️ Tentando recuperar loteria para apostas sem nome...');
    const orphaned = await prisma.bet.findMany({
      where: { OR: [{ loteria: null }, { loteria: '' }] },
      select: { id: true, codigoHorario: true, loteria: true },
    });

    let updated = 0;
    for (const bet of orphaned) {
      const recovered = extractLoteriaFromCodigo(bet.codigoHorario);
      if (recovered) {
        await prisma.bet.update({
          where: { id: bet.id },
          data: { loteria: recovered },
        });
        updated++;
      }
    }

    return res.json({
      orphaned: orphaned.length,
      updated,
      message:
        updated > 0
          ? 'Algumas apostas foram atualizadas com a loteria extraída do código/horário.'
          : 'Nenhuma aposta pôde ser recuperada automaticamente.',
      dica: 'Se alguma continuar sem loteria, consulte o usuário pelo telefone e atualize manualmente.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

exports.repairOrphanedBets = repairOrphanedBets;
