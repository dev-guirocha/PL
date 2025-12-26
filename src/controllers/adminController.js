// src/controllers/adminController.js
// VERSÃO V22 - PRODUCTION FIX
// - FIX: Mapeamento de Famílias (PT SP -> SAO-PAULO, CORUJA -> RIO, etc)
// - CORE: Unifica lógica de match do 'Settle' com o 'Recheck'
// - FIX: Garante leitura de 'MILHAR E CT' corretamente

const prisma = require('../utils/prismaClient');

// --- FUNÇÕES AUXILIARES GLOBAIS ---
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

const getCanonicalName = (str) => {
  return String(str || '')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

// [MÁGICA AQUI] Dicionário de Apelidos
const normalizeLotteryFamily = (name) => {
  const c = getCanonicalName(name); // Ex: "PTSP20HS", "SAOPAULO"

  // RIO DE JANEIRO
  if (c.includes('RIO') && c.includes('FEDERAL')) return 'RIO/FEDERAL';
  if (c.includes('PTRIO') || c.includes('CORUJA') || c.includes('RIO')) return 'RIO/FEDERAL';

  // SÃO PAULO (Aqui resolve o seu caso PT SP)
  if (c.includes('SAO') && c.includes('PAULO')) return 'SAO-PAULO';
  if (c.includes('BAND')) return 'SAO-PAULO'; // Bandeirante
  if (c.includes('PTSP')) return 'SAO-PAULO'; // PT SP
  if (c.includes('SP') && (c.includes('PT') || c.includes('LT'))) return 'SAO-PAULO';

  // MALUQUINHA
  if (c.includes('MALUQ') && c.includes('FEDERAL')) return 'MALUQ FEDERAL';
  if (c.includes('MALUQ')) return 'MALUQUINHA';

  // GOIAS / LOOK
  if (c.includes('LOOK') || c.includes('GOIAS') || c.includes('ALVORADA')) return 'LOOK/GOIAS';

  // NORDESTE
  if (c.includes('LOTECE') || c.includes('LOTEP') || c.includes('PARAIBA') || c.includes('CEARA')) return 'LOTECE/LOTEP';
  if (c.includes('BAHIA')) return 'BAHIA';

  // OUTROS
  if (c.includes('FEDERAL')) return 'FEDERAL';
  if (c.includes('NACIONAL')) return 'NACIONAL';
  if (c.includes('CAPITAL')) return 'CAPITAL';
  if (c.includes('MINAS')) return 'MINAS GERAIS';
  if (c.includes('SORTE')) return 'SORTE';

  return 'UNKNOWN';
};

const toNumberSafe = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasDot && !hasComma) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  if (hasComma && !hasDot) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(',', '.'); 
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const isValidISODate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === (m - 1) && dt.getUTCDate() === d;
};

const pad = (s, len) => String(s).replace(/\D/g, '').slice(-len).padStart(len, '0');
const toMilhar = (s) => pad(s, 4);
const toCentena = (s) => pad(s, 3);
const toDezena = (s) => pad(s, 2);
const toUnidade = (s) => pad(s, 1);
const getGrupoFromMilhar = (milhar4) => {
  const d = parseInt(String(milhar4).slice(-2), 10);
  if (Number.isNaN(d)) return '';
  if (d === 0) return '25';
  return String(Math.ceil(d / 4));
};
const normalizeGrupoPalpite = (p) => {
  const p2 = pad(p, 2);           
  if (p2 === '00') return '25';   
  return p2.startsWith('0') ? p2.slice(1) : p2; 
};
const sortDigits = (str) => String(str).split('').sort().join('');

function nCk(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let res = 1;
  for (let i = 1; i <= k; i++) res = (res * (n - (k - i))) / i;
  return Math.round(res);
}

function parseApostasFromBet(bet) {
  try {
    if (typeof bet.palpites === 'string') return JSON.parse(bet.palpites);
    if (Array.isArray(bet.palpites)) return bet.palpites;
    return []; 
  } catch { return []; }
}

function resolvePayout(modalidade) {
  const table = {
    'TERNO DEZENA': 3000, 'DUQUE DEZENA': 300, 'TERNO GRUPO': 150, 'DUQUE GRUPO': 18,
    'MILHAR INV': 4000, 'CENTENA INV': 400, 'DEZENA INV': 60,
    'MILHAR': 4000, 'CENTENA': 400, 'DEZENA': 60, 'GRUPO': 18, 'UNIDADE': 6, 
  };
  let key = String(modalidade || '').toUpperCase()
    .replace(/\bCT\b/g, 'CENTENA').replace(/\bDZ\b/g, 'DEZENA')
    .replace(/\bGP\b/g, 'GRUPO').replace(/\bUN\b/g, 'UNIDADE');
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (key.includes(k)) return table[k];
  }
  return 0;
}

function indicesFromColocacao(colocacao) {
  const c = String(colocacao || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const frac = c.match(/(\d)\s*\/\s*(\d)/);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (a === 1 && b >= 1) return Array.from({ length: Math.min(b, 7) }, (_, i) => i);
  }
  const eFrac = c.match(/1\s*E\s*1\s*\/\s*(\d)/);
  if (eFrac) {
    const b = Number(eFrac[1]);
    return Array.from({ length: Math.min(b, 7) }, (_, i) => i);
  }
  const fracPremio = c.match(/1\s*\/\s*(\d)\s*PR[ÊE]MIO/);
  if (fracPremio) {
    const b = Number(fracPremio[1]);
    return Array.from({ length: Math.min(b, 7) }, (_, i) => i);
  }
  if (c.startsWith('1')) return [0];
  if (c.startsWith('2')) return [1];
  if (c.startsWith('3')) return [2];
  if (c.startsWith('4')) return [3];
  if (c.startsWith('5')) return [4];
  if (c.startsWith('6')) return [5];
  if (c.startsWith('7')) return [6];
  return [0];
}

function expandModalidades(modalRaw) {
  const m = String(modalRaw || '').toUpperCase();
  const has = (re) => re.test(m);
  if (has(/DUQUE|TERNO|QUADRA|QUINA/)) return ['COMPOSTA'];
  const suffix = [];
  if (has(/INV/)) suffix.push('INV');
  if (has(/ESQ/)) suffix.push('ESQ');
  if (has(/MEIO/)) suffix.push('MEIO');
  const suffixStr = suffix.length ? ' ' + suffix.join(' ') : '';
  const out = [];
  if (has(/MILHAR/)) out.push(('MILHAR' + suffixStr).trim());
  if (has(/CENTENA|\bCT\b/)) out.push(('CENTENA' + suffixStr).trim());
  if (has(/DEZENA|\bDZ\b/)) out.push(('DEZENA' + suffixStr).trim());
  if (has(/UNIDADE|\bUN\b/)) out.push(('UNIDADE' + suffixStr).trim());
  if (has(/GRUPO|\bGP\b/)) out.push('GRUPO');
  return out.length ? out : ['UNKNOWN'];
}

function checkVictory({ modal, palpites, premios }) {
  const m = String(modal || '').toUpperCase();
  const cleanPalpitesRaw = (Array.isArray(palpites) ? palpites : []).map((p) => String(p).replace(/\D/g, ''));
  const uniquePalpitesRaw = [...new Set(cleanPalpitesRaw.filter(Boolean))];
  const uniquePremios4 = [...new Set((Array.isArray(premios) ? premios : []).map(toMilhar).filter(Boolean))];

  if (m.includes('DUQUE') || m.includes('TERNO') || m.includes('QUADRA') || m.includes('QUINA')) {
    const isDuque = m.includes('DUQUE');
    const isTerno = m.includes('TERNO');
    const isQuadra = m.includes('QUADRA');
    const required = isDuque ? 2 : isTerno ? 3 : isQuadra ? 4 : 5;
    const domain = m.includes('GRUPO') || m.includes('GP') ? 'GRUPO' : 'DEZENA';
    const validTargets = uniquePremios4
      .map((p4) => (domain === 'GRUPO' ? getGrupoFromMilhar(p4) : toDezena(p4)))
      .filter(Boolean);
    const normalizedPalpites = uniquePalpitesRaw.map((p) => {
      if (domain === 'GRUPO') return normalizeGrupoPalpite(p);
      return toDezena(p);
    });
    const hits = [...new Set(normalizedPalpites)].filter((p) => validTargets.includes(p));
    const hitCount = hits.length;
    const factor = hitCount >= required ? nCk(hitCount, required) : 0;
    return { factor };
  }

  let kind = 'UNKNOWN';
  if (m.includes('GRUPO')) kind = 'GRUPO';
  else if (m.includes('MILHAR')) kind = 'MILHAR';
  else if (m.includes('CENTENA')) kind = 'CENTENA';
  else if (m.includes('DEZENA')) kind = 'DEZENA';
  else if (m.includes('UNIDADE')) kind = 'UNIDADE';

  const isInv = m.includes('INV');   
  const isEsq = m.includes('ESQ');   
  const isMeio = m.includes('MEIO'); 
  let targets = [];
  if (kind === 'MILHAR') {
    targets = uniquePremios4;
  } else if (kind === 'CENTENA') {
    if (isEsq) targets = uniquePremios4.map(p => p.slice(0, 3)); 
    else targets = uniquePremios4.map(p => toCentena(p));        
  } else if (kind === 'DEZENA') {
    if (isEsq) targets = uniquePremios4.map(p => p.slice(0, 2));      
    else if (isMeio) targets = uniquePremios4.map(p => p.slice(1, 3)); 
    else targets = uniquePremios4.map(p => toDezena(p));              
  } else if (kind === 'UNIDADE') targets = uniquePremios4.map(p => toUnidade(p));
  else if (kind === 'GRUPO') targets = uniquePremios4.map(p => getGrupoFromMilhar(p));

  let requiredLen = 0;
  if (kind === 'MILHAR') requiredLen = 4;
  if (kind === 'CENTENA') requiredLen = 3;
  if (kind === 'DEZENA') requiredLen = 2;
  if (kind === 'UNIDADE') requiredLen = 1;

  const cleanPalpites = uniquePalpitesRaw.map(p => {
    if (kind === 'GRUPO') return normalizeGrupoPalpite(p);
    return pad(p, requiredLen);
  });

  let wins = [];
  if (isInv && kind !== 'GRUPO') {
    const sortedTargets = targets.map(sortDigits);
    wins = cleanPalpites.filter(p => sortedTargets.includes(sortDigits(p)));
  } else {
    wins = cleanPalpites.filter(p => targets.includes(p));
  }
  return { factor: wins.length };
}


// ==========================================
// CONTROLLERS
// ==========================================

exports.getDashboardStats = async (req, res) => {
  try {
    const [usersAgg, betsAgg, withdrawalsAgg, betsCount, totalUsers] = await Promise.all([
      prisma.user.aggregate({ _sum: { balance: true, bonus: true } }),
      prisma.bet.aggregate({ _sum: { total: true } }),
      prisma.withdrawalRequest.aggregate({ where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.bet.count(),
      prisma.user.count(),
    ]);
    res.json({
      totalUsers, betsCount,
      platformFunds: Number(betsAgg._sum.total || 0),
      moneyOut: { bets: Number(betsAgg._sum.total || 0) },
      wallets: { saldo: Number(usersAgg._sum.balance || 0), bonus: Number(usersAgg._sum.bonus || 0), total: Number(usersAgg._sum.balance || 0) + Number(usersAgg._sum.bonus || 0) },
      pendingWithdrawals: { amount: Number(withdrawalsAgg._sum.amount || 0), count: withdrawalsAgg._count?._all || 0 },
    });
  } catch (error) { res.json({}); }
};

exports.listUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const users = await prisma.user.findMany({ take: 50, skip: (page - 1) * 50, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, phone: true, balance: true, cpf: true, isAdmin: true, email: true } });
    const total = await prisma.user.count();
    res.json({ users, total, page });
  } catch(e) { res.status(500).json({error: 'Erro list users'}); }
};

exports.toggleUserBlock = async (req, res) => res.json({ message: "Desativado." });

exports.listBets = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const bets = await prisma.bet.findMany({ take: 50, skip: (page - 1) * 50, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, phone: true } } } });
    const total = await prisma.bet.count();
    res.json({ bets, total, page });
  } catch (e) { res.status(500).json({ error: 'Erro bets' }); }
};

exports.listWithdrawals = async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawalRequest.findMany({ 
        orderBy: { createdAt: 'desc' }, 
        include: { user: { select: { name: true, phone: true } } } 
    });
    res.json({ withdrawals });
  } catch (e) { res.json({ withdrawals: [] }); }
};

exports.listSupervisors = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const supervisors = await prisma.supervisor.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50, include: { users: { select: { id: true, name: true, phone: true } } } });
    const total = await prisma.supervisor.count();
    res.json({ supervisors, total, page });
  } catch (e) { res.json({ supervisors: [], total: 0 }); }
};

exports.createResult = async (req, res) => {
  try {
    const { loteria, dataJogo, codigoHorario, numeros, grupos } = req.body;
    
    const result = await prisma.result.create({
      data: { 
        loteria, dataJogo, codigoHorario, 
        numeros: Array.isArray(numeros) ? JSON.stringify(numeros) : numeros, 
        grupos: Array.isArray(grupos) ? JSON.stringify(grupos) : grupos || '[]'
      },
    });
    res.status(201).json(result);
  } catch (error) { res.status(500).json({ error: 'Erro createResult' }); }
};

exports.listResults = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const results = await prisma.result.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 });
    const total = await prisma.result.count();
    res.json({ results, total, page, totalPages: Math.ceil(total / 20) });
  } catch (e) { res.status(500).json({ error: 'Erro listResults' }); }
};

exports.updateResult = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { numeros, grupos, ...rest } = req.body;
    const data = { ...rest };
    if (numeros) data.numeros = Array.isArray(numeros) ? JSON.stringify(numeros) : numeros;
    if (grupos) data.grupos = Array.isArray(grupos) ? JSON.stringify(grupos) : grupos;
    const updated = await prisma.result.update({ where: { id }, data });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: 'Erro updateResult' }); }
};

exports.deleteResult = async (req, res) => {
  try { await prisma.result.delete({ where: { id: Number(req.params.id) } }); res.json({ msg: 'Deleted' }); } catch (e) { res.status(500).json({ error: 'Erro deleteResult' }); }
};

exports.generatePule = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });
    res.json({ message: 'Pule gerado.', alreadyExists: false });
  } catch (e) { res.status(500).json({ error: 'Erro pule' }); }
};


// [LIQUIDAÇÃO V22 - SMART MATCHING]
exports.settleBetsForResult = async (req, res) => {
  const id = Number(req.params.id);
  console.log(`\n🚀 [V22-SETTLE] LIQUIDANDO RESULTADO ID: ${id}`);

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    const resDate = normalizeDate(result.dataJogo);
    const resHour = extractHour(result.codigoHorario);
    
    if (!isValidISODate(resDate) || resHour === 'XX') {
        return res.status(400).json({ error: 'Resultado com Data ou Hora inválida.' });
    }

    // [UPGRADE V22] Usa a família normalizada
    const resFamily = normalizeLotteryFamily(result.loteria);
    const resCanonical = getCanonicalName(result.loteria);

    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros);
    } catch { numerosSorteados = []; }

    const premios = (Array.isArray(numerosSorteados) ? numerosSorteados : [])
      .map((n) => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'))
      .filter(Boolean);

    if (!premios.length) {
       return res.status(400).json({ error: 'Resultado sem números válidos para liquidar.' });
    }

    const bets = await prisma.bet.findMany({
      where: { 
        status: 'open',
        resultId: null 
      },
      include: { user: true },
    });

    const summary = { matched: 0, settled: 0, wins: 0, errors: [] };

    for (const bet of bets) {
      try {
        const betDate = normalizeDate(bet.dataJogo);
        const betHour = extractHour(bet.codigoHorario);
        
        if (!isValidISODate(betDate) || betHour === 'XX') continue;
        if (betDate !== resDate) continue;
        if (betHour !== resHour) continue;

        // [UPGRADE V22] Match Inteligente Unificado
        const betFamily = normalizeLotteryFamily(bet.loteria);
        const betCanonical = getCanonicalName(bet.loteria);
        
        let match = false;
        
        // 1. Match por Família (Ex: "PT SP" == "SAO-PAULO")
        if (betFamily !== 'UNKNOWN' && betFamily === resFamily) {
            match = true;
        } 
        // 2. Match por Texto (Fallback)
        else {
            if (betCanonical === resCanonical) match = true;
            else if (resCanonical.includes(betCanonical) || betCanonical.includes(resCanonical)) match = true;
        }

        if (!match) continue;
        summary.matched++;

        const apostas = parseApostasFromBet(bet);
        if (!apostas || !apostas.length) {
          const voidTx = await prisma.bet.updateMany({
            where: { id: bet.id, status: 'open', resultId: null },
            data: { status: 'lost', settledAt: new Date(), resultId: id, prize: 0 },
          });
          if (voidTx.count > 0) summary.settled++;
          continue;
        }

        let prize = 0;
        for (const aposta of apostas) {
          const modalRaw = aposta.modalidade || bet.modalidade || '';
          const colocacaoRaw = aposta.colocacao || bet.colocacao || '';
          const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
          const palpCount = palpites.length || 0;
          
          const rawTotal = (aposta.total !== undefined && aposta.total !== null) ? aposta.total : bet.total;
          const betTotalNum = toNumberSafe(rawTotal);
          const valPorNum = toNumberSafe(aposta.valorPorNumero);

          const perNumber = valPorNum > 0 ? valPorNum : (palpCount > 0 ? betTotalNum / palpCount : 0);

          if (!perNumber || perNumber <= 0 || !palpCount) continue;

          const allowedIdx = indicesFromColocacao(colocacaoRaw);
          const premiosAllowed = allowedIdx.map((i) => premios[i]).filter(Boolean);
          if (!premiosAllowed.length) continue;

          const baseMods = expandModalidades(modalRaw);

          if (baseMods.length > 1 && !baseMods.includes('COMPOSTA') && !baseMods.includes('UNKNOWN')) {
            for (const palpite of palpites) {
              let bestForThisPalpite = 0;
              for (const base of baseMods) {
                const payout = resolvePayout(base);
                if (!payout) continue;
                const { factor } = checkVictory({ modal: base, palpites: [palpite], premios: premiosAllowed });
                if (factor > 0) {
                  const amount = perNumber * payout * factor;
                  if (amount > bestForThisPalpite) bestForThisPalpite = amount;
                }
              }
              prize += bestForThisPalpite;
            }
          } else {
            const payout = resolvePayout(modalRaw);
            if (!payout) continue; 
            const { factor } = checkVictory({ modal: modalRaw, palpites, premios: premiosAllowed });
            if (factor > 0) prize += perNumber * payout * factor;
          }
        }

        const finalPrize = Number(prize.toFixed(2));
        const status = finalPrize > 0 ? 'won' : 'lost';

        const didSettle = await prisma.$transaction(async (tx) => {
          const updateBatch = await tx.bet.updateMany({
            where: { id: bet.id, status: 'open', resultId: null },
            data: { status, prize: finalPrize, settledAt: new Date(), resultId: id },
          });

          if (updateBatch.count === 0) return false;

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
                description: `Prêmio (${bet.id})`
              },
            });
          }
          return true;
        });

        if (didSettle) {
            summary.settled++;
            if (finalPrize > 0) summary.wins++;
        }
      } catch (innerErr) {
        summary.errors.push({ id: bet.id, msg: innerErr?.message || String(innerErr) });
      }
    }
    
    return res.json({ message: 'Processamento concluído', summary: { processed: bets.length, ...summary } });

  } catch (err) {
    console.error('Erro fatal:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};

// [RECHECK SINGLE BET - V22 UNIFICADO]
exports.recheckSingleBet = async (req, res) => {
  const betId = Number(req.params.id);
  console.log(`\n🕵️ [V22-RECHECK] Aposta ID: ${betId}`);

  try {
    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { user: true }
    });

    if (!bet) return res.status(404).json({ error: 'Aposta não encontrada' });

    const betDateISO = normalizeDate(bet.dataJogo);
    const betHour = extractHour(bet.codigoHorario);

    if (!isValidISODate(betDateISO) || betHour === 'XX') {
      return res.status(400).json({ error: 'Aposta com data/hora inválida.' });
    }

    const betFamily = normalizeLotteryFamily(bet.loteria);
    const [ano, mes, dia] = betDateISO.split('-');
    const betDateBR = `${dia}/${mes}/${ano}`;

    const candidates = await prisma.result.findMany({
      where: {
        OR: [
          { dataJogo: { contains: betDateISO } },
          { dataJogo: { contains: betDateBR } },
          { dataJogo: String(bet.dataJogo) }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    let matchingResult = null;

    for (const r of candidates) {
      const rDate = normalizeDate(r.dataJogo);
      const rHour = extractHour(r.codigoHorario);
      if (rDate !== betDateISO) continue;
      if (rHour !== betHour) continue;

      const rFamily = normalizeLotteryFamily(r.loteria);
      const familyMatch = (betFamily !== 'UNKNOWN' && betFamily === rFamily);
      
      const betCanonical = getCanonicalName(bet.loteria);
      const rCanonical = getCanonicalName(r.loteria);
      const fallbackMatch = (rCanonical === betCanonical) || rCanonical.includes(betCanonical) || betCanonical.includes(rCanonical);

      if (familyMatch || fallbackMatch) {
        matchingResult = r;
        break;
      }
    }

    if (!matchingResult) {
      return res.status(404).json({ error: 'Resultado correspondente não encontrado.' });
    }

    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(matchingResult.numeros)
        ? matchingResult.numeros
        : JSON.parse(matchingResult.numeros);
    } catch { numerosSorteados = []; }

    const premios = (Array.isArray(numerosSorteados) ? numerosSorteados : [])
      .map(n => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'))
      .filter(Boolean);

    if (!premios.length) {
      return res.status(400).json({ error: 'Resultado encontrado, mas sem números válidos.' });
    }

    const apostas = parseApostasFromBet(bet);
    let prize = 0;

    for (const aposta of apostas) {
      const modalRaw = aposta.modalidade || bet.modalidade || '';
      const colocacaoRaw = aposta.colocacao || bet.colocacao || '';
      const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
      const palpCount = palpites.length || 0;

      const rawTotal = (aposta.total !== undefined && aposta.total !== null) ? aposta.total : bet.total;
      const betTotalNum = toNumberSafe(rawTotal);
      const valPorNum = toNumberSafe(aposta.valorPorNumero);

      const perNumber = valPorNum > 0 ? valPorNum : (palpCount > 0 ? betTotalNum / palpCount : 0);
      if (!perNumber || perNumber <= 0 || !palpCount) continue;

      const allowedIdx = indicesFromColocacao(colocacaoRaw);
      const premiosAllowed = allowedIdx.map(i => premios[i]).filter(Boolean);
      if (!premiosAllowed.length) continue;

      const baseMods = expandModalidades(modalRaw);

      if (baseMods.length > 1 && !baseMods.includes('COMPOSTA') && !baseMods.includes('UNKNOWN')) {
        for (const palpite of palpites) {
          let best = 0;
          for (const base of baseMods) {
            const payout = resolvePayout(base);
            if (!payout) continue;
            const { factor } = checkVictory({ modal: base, palpites: [palpite], premios: premiosAllowed });
            if (factor > 0) {
              const amount = perNumber * payout * factor;
              if (amount > best) best = amount;
            }
          }
          prize += best;
        }
      } else {
        const payout = resolvePayout(modalRaw);
        if (!payout) continue;
        const { factor } = checkVictory({ modal: modalRaw, palpites, premios: premiosAllowed });
        if (factor > 0) prize += perNumber * payout * factor;
      }
    }

    const finalPrize = Number(prize.toFixed(2));
    const newStatus = finalPrize > 0 ? 'won' : 'lost';

    const oldStatus = bet.status;
    const oldPrize = toNumberSafe(String(bet.prize ?? 0));

    if (newStatus === oldStatus && Number(finalPrize.toFixed(2)) === Number(oldPrize.toFixed(2))) {
      return res.json({
        message: `Aposta já está correta (${newStatus}). Nenhuma alteração.`,
        bet,
        matchedResult: { id: matchingResult.id, loteria: matchingResult.loteria }
      });
    }

    await prisma.$transaction(async (tx) => {
      if (oldStatus === 'won' && oldPrize > 0) {
        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: { decrement: oldPrize } }
        });
        await tx.transaction.create({
          data: {
            userId: bet.userId,
            type: 'adjustment',
            amount: -oldPrize,
            description: `Estorno Correção (${bet.id})`
          }
        });
      }

      const upd = await tx.bet.updateMany({
        where: {
          id: bet.id,
          status: oldStatus,
          // prize: bet.prize // Opcional
        },
        data: {
          status: newStatus,
          prize: finalPrize,
          settledAt: new Date(),
          resultId: matchingResult.id
        }
      });

      if (upd.count === 0) {
        throw new Error('Aposta foi alterada por outro processo. Tente novamente.');
      }

      if (finalPrize > 0) {
        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: { increment: finalPrize } }
        });
        await tx.transaction.create({
          data: {
            userId: bet.userId,
            type: 'prize',
            amount: finalPrize,
            description: `Prêmio Recalculado (${bet.id})`
          }
        });
      }
    });

    return res.json({
      message: 'Aposta corrigida com sucesso!',
      changes: { from: { status: oldStatus, prize: oldPrize }, to: { status: newStatus, prize: finalPrize } },
      matchedResult: { id: matchingResult.id, loteria: matchingResult.loteria }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Erro interno ao reconferir.' });
  }
};

// ALIASES
exports.getStats = exports.getDashboardStats;
exports.getDashboard = exports.getDashboardStats;
exports.getUsers = exports.listUsers;
exports.getBets = exports.listBets;
exports.getWithdrawals = exports.listWithdrawals;
exports.getResults = exports.listResults;
exports.getSupervisors = exports.listSupervisors;
