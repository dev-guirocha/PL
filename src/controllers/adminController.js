// src/controllers/adminController.js
// VERSÃO V34B - FINAL PRODUCTION (CENTRALIZED NORMALIZATION + PATCHED CONSISTENCY)
// - ARCH: Normalização da modalidade ocorre UMA VEZ (modalNorm) e é usada em TODO downstream.
// - FIX: PALPITÃO normaliza para PALPITAO (removendo acento), evitando drift.
// - FIX: expandModalidades reconhece PALPITAO (já normalizado) e compostas são consistentes.
// - CORE: Engine V3.3 (Hybrid Logic, Synced Recheck, Reconstitutable Audit).

const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prismaClient');

// --- CONSTANTES ---
const MAX_AUTO_PAYOUT = 10000; // Teto para aprovação automática
const AUDIT_LOGS = process.env.AUDIT_LOGS === '1'; // Controlado por ENV
const ZERO_DECIMAL = new Prisma.Decimal(0);
const MAX_AUTO_PAYOUT_DEC = new Prisma.Decimal(MAX_AUTO_PAYOUT);

const toDecimalSafe = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === '') return ZERO_DECIMAL;
  try {
    return new Prisma.Decimal(String(value));
  } catch {
    return ZERO_DECIMAL;
  }
};

const toDecimalMoney = (value) => toDecimalSafe(value).toDecimalPlaces(2);

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
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
};

const getCanonicalName = (str) => {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

const normalizeLotteryFamily = (name) => {
  const c = getCanonicalName(name);
  if (c.includes('RIO') && c.includes('FEDERAL')) return 'RIO/FEDERAL';
  if (c.includes('PTRIO') || c.includes('CORUJA') || c.includes('RIO')) return 'RIO/FEDERAL';
  if (c.includes('SAO') && c.includes('PAULO')) return 'SAO-PAULO';
  if (c.includes('BAND')) return 'SAO-PAULO';
  if (c.includes('PTSP')) return 'SAO-PAULO';
  if (c.includes('SP') && (c.includes('PT') || c.includes('LT'))) return 'SAO-PAULO';
  if (c.includes('MALUQ') && c.includes('FEDERAL')) return 'MALUQ FEDERAL';
  if (c.includes('MALUQ')) return 'MALUQUINHA';
  if (c.includes('LOOK') || c.includes('GOIAS') || c.includes('ALVORADA')) return 'LOOK/GOIAS';
  if (c.includes('LOTECE') || c.includes('LOTEP') || c.includes('PARAIBA') || c.includes('CEARA')) return 'LOTECE/LOTEP';
  if (c.includes('BAHIA')) return 'BAHIA';
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

const normalizeModalidade = (raw) => {
  let m = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split('@')[0]           // remove lixo da colocação (ex: " @ 1 PREMIO ...")
    .replace(/[().]/g, '')   // remove pontuação
    .replace(/\s+/g, ' ')
    .trim();

  // 1) Expande abreviações relevantes ANTES de decidir MC
  // (Isso evita perder variantes como "MILHAR E CT", "MILHAR CENT", etc.)
  m = m
    .replace(/\bCT\b/g, 'CENTENA')
    .replace(/\bCENT\b/g, 'CENTENA')
    .replace(/\bDZ\b/g, 'DEZENA')
    .replace(/\bGP\b/g, 'GRUPO')
    .replace(/\bUN\b/g, 'UNIDADE')
    .replace(/\s+/g, ' ')
    .trim();

  // 2) Alias diretos (tokens "limpos")
  const ALIAS = {
    'MILHAR/CENTENA': 'MILHAR E CENTENA',
    'MILHAR E CENTENA': 'MILHAR E CENTENA',
    'MILHAR E CENT': 'MILHAR E CENTENA',
    'MILHAR E CT': 'MILHAR E CENTENA',
    'MC': 'MILHAR E CENTENA',
    'M C': 'MILHAR E CENTENA',
  };
  m = ALIAS[m] || m;

  // 3) Heurística robusta: se contém as duas palavras, é MC
  // Cobre: "MILHAR-CENTENA", "MILHAR / CENTENA", "MILHAR CENTENA", etc.
  if (/\bMILHAR\b/.test(m) && /\bCENTENA\b/.test(m)) {
    m = 'MILHAR E CENTENA';
  }

  return m;
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
  } catch {
    return [];
  }
}

function normalizeColocacao(raw) {
  return String(raw || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function getColocacaoFraction(colocacaoRaw) {
  const c = normalizeColocacao(colocacaoRaw);
  const m = c.match(/(\d+)\s*(?:AO|A|\/|-)\s*(\d+)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b > 0) return { a, b };
  }
  if (/^(1|1\s*PREMIO|1\s*PRÊMIO)\b/.test(c)) return { a: 1, b: 1 };
  return null;
}

function resolvePayoutV2(m) {
  if (m === 'MILHAR') return { type: 'base', value: 8000 };
  if (m === 'CENTENA') return { type: 'base', value: 800 };
  if (m === 'DEZENA') return { type: 'base', value: 80 };
  if (m === 'GRUPO') return { type: 'base', value: 20 };
  if (m === 'UNIDADE') return { type: 'base', value: 8 };

  if (m.includes('MILHAR') && (m.includes('INV') || m.includes('INVERSA'))) return { type: 'base', value: 333.33 };
  if (m.includes('CENTENA') && (m.includes('INV') || m.includes('INVERSA'))) return { type: 'base', value: 133.33 };

  const fixo1_5 = { type: 'fixed', allowedFractions: [{ a: 1, b: 5 }] };

  if (m.includes('DUQUE') && m.includes('DEZ')) return { ...fixo1_5, value: 300 };
  if (m.includes('TERNO') && m.includes('DEZ') && !m.includes('SECO')) return { ...fixo1_5, value: 5000 };

  if (m.includes('DUQUE') && m.includes('GRUPO')) return { ...fixo1_5, value: 18 };
  if (m.includes('TERNO') && m.includes('GRUPO')) return { ...fixo1_5, value: 150 };
  if (m.includes('QUADRA') && m.includes('GRUPO')) return { ...fixo1_5, value: 1000 };

  if (m.includes('PASSE VAI') && !m.includes('VEM')) return { ...fixo1_5, value: 100 };
  if (m.includes('PASSE VAI') && m.includes('VEM')) return { ...fixo1_5, value: 55 };
  if (m.includes('PALPITAO')) return { ...fixo1_5, value: 800 };

  if (m.includes('TERNO') && m.includes('DEZ') && m.includes('SECO')) {
    return { type: 'fixed', value: 10000, allowedFractions: [{ a: 1, b: 3 }] };
  }

  // Composta híbrida (MILHAR + CENTENA): deixa passar; cálculo real é pela expansão


  if (m.includes('MILHAR') && m.includes('CENTENA')) return { type: 'base', value: 0 };


  


  return { type: 'unknown', value: 0 };
}

function isAllowedFraction(allowedFractions, frac) {
  if (!allowedFractions || allowedFractions.length === 0) return true;
  if (!frac) return false;
  return allowedFractions.some((x) => x.a === frac.a && x.b === frac.b);
}

function computeFinalPayout({ modalidadeRaw, colocacaoRaw }) {
  const p = resolvePayoutV2(modalidadeRaw);

  if (p.type === 'unknown') {
    return { ok: false, payout: 0, reason: 'UNKNOWN_MODALIDADE' };
  }

  const frac = getColocacaoFraction(colocacaoRaw);

  if (p.type === 'fixed') {
    if (!isAllowedFraction(p.allowedFractions, frac)) {
      return { ok: false, payout: 0, reason: 'INVALID_COLOCACAO' };
    }
    return { ok: true, payout: p.value };
  }

  if (!frac) return { ok: true, payout: p.value };

  if (frac.a === 1 && frac.b >= 1) {
    return { ok: true, payout: p.value / frac.b };
  }

  return { ok: false, payout: 0, reason: 'UNSUPPORTED_FRACTION' };
}

function indicesFromColocacao(colocacao) {
  const frac = getColocacaoFraction(colocacao);

  if (frac && frac.a !== 1) return [];

  if (frac && frac.a === 1) {
    return Array.from({ length: Math.min(frac.b, 7) }, (_, i) => i);
  }

  const c = normalizeColocacao(colocacao);
  if (/^(1|1\s*PREMIO|1\s*PRÊMIO)\b/.test(c)) return [0];
  if (/^2\b/.test(c)) return [1];
  if (/^3\b/.test(c)) return [2];
  if (/^4\b/.test(c)) return [3];
  if (/^5\b/.test(c)) return [4];
  if (/^6\b/.test(c)) return [5];
  if (/^7\b/.test(c)) return [6];

  return [];
}

function expandModalidades(m) {
  const has = (re) => re.test(m);

  if (has(/DUQUE|TERNO|QUADRA|QUINA|PASSE|PALPITAO/)) return ['COMPOSTA'];

  const suffix = [];
  if (has(/INV/)) suffix.push('INV');
  if (has(/ESQ/)) suffix.push('ESQ');
  if (has(/MEIO/)) suffix.push('MEIO');
  const suffixStr = suffix.length ? ' ' + suffix.join(' ') : '';

  const out = [];
  if (has(/MILHAR/)) out.push(('MILHAR' + suffixStr).trim());
  if (has(/CENTENA/)) out.push(('CENTENA' + suffixStr).trim());
  if (has(/DEZENA/)) out.push(('DEZENA' + suffixStr).trim());
  if (has(/UNIDADE/)) out.push(('UNIDADE' + suffixStr).trim());
  if (has(/GRUPO/)) out.push('GRUPO');

  return out.length ? out : ['UNKNOWN'];
}

function checkVictory({ modal, palpites, premios }) {
  const m = modal;
  const cleanPalpitesRaw = (Array.isArray(palpites) ? palpites : []).map((p) => String(p).replace(/\D/g, ''));
  const uniquePalpitesRaw = [...new Set(cleanPalpitesRaw.filter(Boolean))];
  const uniquePremios4 = [...new Set((Array.isArray(premios) ? premios : []).map(toMilhar).filter(Boolean))];

  if (m.includes('DUQUE') || m.includes('TERNO') || m.includes('QUADRA') || m.includes('QUINA') || m.includes('PASSE') || m.includes('PALPITAO')) {
    const isDuque = m.includes('DUQUE');
    const isTerno = m.includes('TERNO');
    const isQuadra = m.includes('QUADRA');
    const isPasse = m.includes('PASSE');
    const isPalpitao = m.includes('PALPITAO');

    let required = 0;
    if (isDuque) required = 2;
    else if (isTerno) required = 3;
    else if (isQuadra) required = 4;
    else if (isPasse) required = 2;
    else if (isPalpitao) required = 1;

    const domain = (m.includes('GRUPO') || isPasse || isPalpitao) ? 'GRUPO' : 'DEZENA';

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

    return { factor, hits, required, domain };
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
    if (isEsq) targets = uniquePremios4.map((p) => p.slice(0, 3));
    else targets = uniquePremios4.map((p) => toCentena(p));
  } else if (kind === 'DEZENA') {
    if (isEsq) targets = uniquePremios4.map((p) => p.slice(0, 2));
    else if (isMeio) targets = uniquePremios4.map((p) => p.slice(1, 3));
    else targets = uniquePremios4.map((p) => toDezena(p));
  } else if (kind === 'UNIDADE') targets = uniquePremios4.map((p) => toUnidade(p));
  else if (kind === 'GRUPO') targets = uniquePremios4.map((p) => getGrupoFromMilhar(p));

  let requiredLen = 0;
  if (kind === 'MILHAR') requiredLen = 4;
  if (kind === 'CENTENA') requiredLen = 3;
  if (kind === 'DEZENA') requiredLen = 2;
  if (kind === 'UNIDADE') requiredLen = 1;

  const cleanPalpites = uniquePalpitesRaw.map((p) => {
    if (kind === 'GRUPO') return normalizeGrupoPalpite(p);
    return pad(p, requiredLen);
  });

  let wins = [];
  if (isInv && kind !== 'GRUPO') {
    const sortedTargets = targets.map(sortDigits);
    wins = cleanPalpites.filter((p) => sortedTargets.includes(sortDigits(p)));
  } else {
    wins = cleanPalpites.filter((p) => targets.includes(p));
  }

  return { factor: wins.length, wins };
}

// ==========================================
// CONTROLLERS
// ==========================================

exports.getDashboardStats = async (req, res) => {
  try {
    const [usersAgg, betsAgg, withdrawalsAgg, betsCount, totalUsers] = await Promise.all([
      prisma.user.aggregate({ where: { deletedAt: null }, _sum: { balance: true, bonus: true } }),
      prisma.bet.aggregate({ _sum: { total: true } }),
      prisma.withdrawalRequest.aggregate({ where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.bet.count(),
      prisma.user.count({ where: { deletedAt: null } }),
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
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      take: 50,
      skip: (page - 1) * 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, phone: true, balance: true, cpf: true, isAdmin: true, email: true, isBlocked: true },
    });
    const total = await prisma.user.count({ where: { deletedAt: null } });
    res.json({ users, total, page });
  } catch(e) { res.status(500).json({error: 'Erro list users'}); }
};

exports.toggleUserBlock = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const user = await prisma.user.findUnique({ where: { id }, select: { isBlocked: true, deletedAt: true } });
    if (!user || user.deletedAt) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const updated = await prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked },
      select: { id: true, isBlocked: true },
    });

    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao bloquear usuário.' });
  }
};

exports.softDeleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const updated = await prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), isAdmin: false },
    });

    if (!updated.count) {
      return res.status(404).json({ error: 'Usuário não encontrado ou já removido.' });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
};

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

exports.settleBetsForResult = async (req, res) => {
  const id = Number(req.params.id);
  console.log(`\n🚀 [V34B-SETTLE] LIQUIDANDO RESULTADO ID: ${id}`);

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    const resDate = normalizeDate(result.dataJogo);
    const resHour = extractHour(result.codigoHorario);

    if (!isValidISODate(resDate) || resHour === 'XX') {
      return res.status(400).json({ error: 'Resultado com Data ou Hora inválida.' });
    }

    const resFamily = normalizeLotteryFamily(result.loteria);
    const resCanonical = getCanonicalName(result.loteria);

    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros);
    } catch {
      numerosSorteados = [];
    }

    const premios = (Array.isArray(numerosSorteados) ? numerosSorteados : [])
      .map((n) => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'))
      .filter(Boolean);

    if (!premios.length) {
      return res.status(400).json({ error: 'Resultado sem números válidos para liquidar.' });
    }

    const bets = await prisma.bet.findMany({
      where: { status: 'open', resultId: null },
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

        const betFamily = normalizeLotteryFamily(bet.loteria);
        const betCanonical = getCanonicalName(bet.loteria);

        let match = false;
        if (betFamily !== 'UNKNOWN' && betFamily === resFamily) match = true;
        else if (betCanonical === resCanonical || resCanonical.includes(betCanonical) || betCanonical.includes(resCanonical)) match = true;

        if (!match) continue;
        summary.matched++;

        const apostas = parseApostasFromBet(bet);
        if (!apostas || !apostas.length) {
          await prisma.bet.updateMany({
            where: { id: bet.id },
            data: { status: 'lost', settledAt: new Date(), resultId: id, prize: 0 },
          });
          summary.settled++;
          continue;
        }

        let prize = ZERO_DECIMAL;
        let requiresManualReview = false;

        for (const aposta of apostas) {
          const modalSrc = aposta.modalidade || bet.modalidade || '';
          const modalNorm = normalizeModalidade(modalSrc);

          const colocacaoRaw = String(aposta.colocacao || bet.colocacao || '').trim();
          const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];

          const rawTotal = aposta.total !== undefined && aposta.total !== null ? aposta.total : bet.total;
          const betTotalNum = toDecimalMoney(rawTotal);
          const valPorNum = toDecimalMoney(aposta.valorPorNumero);
          const palpCount = palpites.length || 0;
          const perNumber = valPorNum.greaterThan(ZERO_DECIMAL)
            ? valPorNum
            : palpCount > 0
              ? betTotalNum.div(new Prisma.Decimal(palpCount))
              : ZERO_DECIMAL;

          if (!perNumber.greaterThan(ZERO_DECIMAL) || !palpCount) continue;

          if (modalNorm.includes('PASSE') || modalNorm.includes('PALPITAO')) {
            requiresManualReview = true;
          }

          const { ok, payout, reason } = computeFinalPayout({ modalidadeRaw: modalNorm, colocacaoRaw });
          if (!ok) {
            console.warn(`[BET ${bet.id}] Ignorada: ${reason} (${modalNorm} @ ${colocacaoRaw})`);
            continue;
          }

          const allowedIdx = indicesFromColocacao(colocacaoRaw);
          if (!allowedIdx.length) {
            console.warn(`[BET ${bet.id}] COLOCACAO_INVALIDA_FAIL_CLOSED (${colocacaoRaw})`);
            continue;
          }

          const premiosAllowed = allowedIdx.map((i) => premios[i]).filter(Boolean);
          if (!premiosAllowed.length) continue;

          const baseMods = expandModalidades(modalNorm);

          if (baseMods.length > 1 && !baseMods.includes('COMPOSTA') && !baseMods.includes('UNKNOWN')) {
            for (const palpite of palpites) {
              // Detecta híbrida MILHAR E CENTENA (MC)
              const isHybridMC = baseMods.length === 2 &&
                baseMods.includes('MILHAR') &&
                baseMods.includes('CENTENA');

              // MC: divide a stake 50/50; outras expansões seguem 100%
              const stakeFactor = isHybridMC ? new Prisma.Decimal('0.5') : new Prisma.Decimal(1);

              let amountForThisPalpite = ZERO_DECIMAL;
              let bestMeta = null;

              for (const base of baseMods) {
                const sub = computeFinalPayout({ modalidadeRaw: base, colocacaoRaw });
                if (!sub.ok) continue;

                const { factor } = checkVictory({ modal: base, palpites: [palpite], premios: premiosAllowed });
                if (factor > 0) {
                  const winPart = perNumber
                    .mul(stakeFactor)
                    .mul(new Prisma.Decimal(String(sub.payout || 0)))
                    .mul(new Prisma.Decimal(factor));

                  if (isHybridMC) {
                    amountForThisPalpite = amountForThisPalpite.add(winPart);
                    if (AUDIT_LOGS) console.log('[AUDIT MC PART]', { mod: base, win: winPart.toFixed(2) });
                  } else {
                    if (winPart.greaterThan(amountForThisPalpite)) {
                      amountForThisPalpite = winPart;
                      bestMeta = {
                        betId: bet.id,
                        resultId: id,
                        colocacao: colocacaoRaw,
                        palpite,
                        mod: base,
                        stake: perNumber.toFixed(2),
                        payout: sub.payout,
                        factor,
                        win: winPart.toFixed(2),
                      };
                    }
                  }
                }
              }

              if (amountForThisPalpite.greaterThan(ZERO_DECIMAL)) {
                if (AUDIT_LOGS && bestMeta && !isHybridMC) console.log('[AUDIT WIN]', bestMeta);
                if (AUDIT_LOGS && isHybridMC) console.log('[AUDIT WIN MC]', { betId: bet.id, win: amountForThisPalpite.toFixed(2) });
                prize = prize.add(amountForThisPalpite);
              }
            }
          } else {
            const isComposta = /DUQUE|TERNO|QUADRA|QUINA|PASSE|PALPITAO/.test(modalNorm);

            if (isComposta) {
              const { factor, hits, required, domain } = checkVictory({
                modal: modalNorm,
                palpites,
                premios: premiosAllowed,
              });

              if (factor > 0) {
                const amount = perNumber
                  .mul(new Prisma.Decimal(String(payout || 0)))
                  .mul(new Prisma.Decimal(factor));
                prize = prize.add(amount);

                if (AUDIT_LOGS)
                  console.log('[AUDIT WIN]', {
                    betId: bet.id,
                    resultId: id,
                    colocacao: colocacaoRaw,
                    palpite: Array.isArray(hits) ? hits : null,
                    required: Number.isFinite(required) ? required : null,
                    domain: domain || null,
                    palpitesCount: palpites.length,
                    mod: modalNorm,
                    stake: perNumber.toFixed(2),
                    payout,
                    factor,
                    win: amount.toFixed(2),
                  });
              }
            } else {
              const { factor, wins } = checkVictory({ modal: modalNorm, palpites, premios: premiosAllowed });

              if (factor > 0 && (!Array.isArray(wins) || wins.length === 0)) {
                console.warn(`[BET ${bet.id}] WIN_WITHOUT_WINS_FAIL_CLOSED (${modalNorm} @ ${colocacaoRaw})`);
                continue;
              }

              if (Array.isArray(wins) && wins.length) {
                for (const w of wins) {
                  const amount = perNumber.mul(new Prisma.Decimal(String(payout || 0)));
                  prize = prize.add(amount);

                  if (AUDIT_LOGS)
                    console.log('[AUDIT WIN]', {
                      betId: bet.id,
                      resultId: id,
                      colocacao: colocacaoRaw,
                      palpite: w,
                      palpitesCount: palpites.length,
                      mod: modalNorm,
                      stake: perNumber.toFixed(2),
                      payout,
                      factor: 1,
                      win: amount.toFixed(2),
                    });
                }
              }
            }
          }
        }

        const finalPrize = prize.toDecimalPlaces(2);

        let status = 'lost';
        if (finalPrize.greaterThan(ZERO_DECIMAL)) {
          status = 'won';
          if (requiresManualReview || finalPrize.greaterThan(MAX_AUTO_PAYOUT_DEC)) {
            status = 'pending_review';
            console.warn(
              `[BET ${bet.id}] Review: Prize=${finalPrize.toFixed(2)}, Reason=${requiresManualReview ? 'COMPLEX_MODAL' : 'HIGH_VALUE'}`
            );
          }
        }

        const didSettle = await prisma.$transaction(async (tx) => {
          const updateBatch = await tx.bet.updateMany({
            where: { id: bet.id, status: 'open', resultId: null, recheckedAt: null },
            data: { status, prize: finalPrize, settledAt: new Date(), resultId: id },
          });

          if (updateBatch.count === 0) return false;

          if (status === 'won' && finalPrize.greaterThan(ZERO_DECIMAL)) {
            const creditLock = await tx.bet.updateMany({
              where: { id: bet.id, prizeCreditedAt: null, status: 'won', prize: finalPrize },
              data: { prizeCreditedAt: new Date() },
            });
            if (creditLock.count) {
              await tx.user.update({
                where: { id: bet.userId },
                data: { balance: { increment: finalPrize } },
              });
              await tx.transaction.create({
                data: { userId: bet.userId, type: 'prize', amount: finalPrize, description: `Prêmio (${bet.id})` },
              });
            }
          }
          return true;
        });

        if (didSettle) {
          summary.settled++;
          if (finalPrize.greaterThan(ZERO_DECIMAL)) summary.wins++;
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

exports.recheckSingleBet = async (req, res) => {
  const betId = Number(req.params.id);
  console.log(`\n🕵️ [V34B-RECHECK] Aposta ID: ${betId}`);

  try {
    const bet = await prisma.bet.findUnique({ where: { id: betId }, include: { user: true } });
    if (!bet) return res.status(404).json({ error: 'Aposta não encontrada' });
    if (bet.recheckedAt) return res.status(409).json({ error: 'Recheck já processado.' });

    const betDateISO = normalizeDate(bet.dataJogo);
    const betHour = extractHour(bet.codigoHorario);
    if (!isValidISODate(betDateISO) || betHour === 'XX') return res.status(400).json({ error: 'Data inválida' });

    const betFamily = normalizeLotteryFamily(bet.loteria);
    const [ano, mes, dia] = betDateISO.split('-');
    const betDateBR = `${dia}/${mes}/${ano}`;

    const candidatesFull = await prisma.result.findMany({
      where: { OR: [{ dataJogo: { contains: betDateISO } }, { dataJogo: { contains: betDateBR } }, { dataJogo: String(bet.dataJogo) }] },
      orderBy: { createdAt: 'desc' },
    });

    let matchingResult = null;
    for (const r of candidatesFull) {
      const rDate = normalizeDate(r.dataJogo);
      const rHour = extractHour(r.codigoHorario);
      if (rDate !== betDateISO) continue;
      if (rHour !== betHour) continue;

      const rFamily = normalizeLotteryFamily(r.loteria);
      const familyMatch = betFamily !== 'UNKNOWN' && betFamily === rFamily;

      const betCanonical = getCanonicalName(bet.loteria);
      const rCanonical = getCanonicalName(r.loteria);

      if (familyMatch || rCanonical === betCanonical || rCanonical.includes(betCanonical) || betCanonical.includes(rCanonical)) {
        matchingResult = r;
        break;
      }
    }

    if (!matchingResult) return res.status(404).json({ error: 'Resultado correspondente não encontrado.' });

    let numerosSorteados = [];
    try {
      numerosSorteados = Array.isArray(matchingResult.numeros) ? matchingResult.numeros : JSON.parse(matchingResult.numeros);
    } catch {
      numerosSorteados = [];
    }

    const premios = (Array.isArray(numerosSorteados) ? numerosSorteados : [])
      .map((n) => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'))
      .filter(Boolean);

    if (!premios.length) return res.status(400).json({ error: 'Resultado sem números válidos.' });

    const apostas = parseApostasFromBet(bet);
    let prize = ZERO_DECIMAL;
    let requiresManualReview = false;

    for (const aposta of apostas) {
      const modalSrc = aposta.modalidade || bet.modalidade || '';
      const modalNorm = normalizeModalidade(modalSrc);

      const colocacaoRaw = String(aposta.colocacao || bet.colocacao || '').trim();
      const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];

      const rawTotal = aposta.total !== undefined && aposta.total !== null ? aposta.total : bet.total;
      const betTotalNum = toDecimalMoney(rawTotal);
      const valPorNum = toDecimalMoney(aposta.valorPorNumero);
      const palpCount = palpites.length || 0;
      const perNumber = valPorNum.greaterThan(ZERO_DECIMAL)
        ? valPorNum
        : palpCount > 0
          ? betTotalNum.div(new Prisma.Decimal(palpCount))
          : ZERO_DECIMAL;

      if (!perNumber.greaterThan(ZERO_DECIMAL) || !palpCount) continue;

      if (modalNorm.includes('PASSE') || modalNorm.includes('PALPITAO')) {
        requiresManualReview = true;
      }

      const { ok, payout, reason } = computeFinalPayout({ modalidadeRaw: modalNorm, colocacaoRaw });
      if (!ok) {
        console.warn(`[BET ${bet.id}] Ignorada: ${reason} (${modalNorm} @ ${colocacaoRaw})`);
        continue;
      }

      const allowedIdx = indicesFromColocacao(colocacaoRaw);
      if (!allowedIdx.length) {
        console.warn(`[BET ${bet.id}] COLOCACAO_INVALIDA_FAIL_CLOSED (${colocacaoRaw})`);
        continue;
      }

      const premiosAllowed = allowedIdx.map((i) => premios[i]).filter(Boolean);
      if (!premiosAllowed.length) continue;

      const baseMods = expandModalidades(modalNorm);

      if (baseMods.length > 1 && !baseMods.includes('COMPOSTA') && !baseMods.includes('UNKNOWN')) {
        // Detecta híbrida MILHAR E CENTENA
        const isHybridMC = baseMods.length === 2 &&
                           baseMods.includes('MILHAR') &&
                           baseMods.includes('CENTENA');
        const stakeFactor = isHybridMC ? new Prisma.Decimal('0.5') : new Prisma.Decimal(1);

        for (const palpite of palpites) {
          let amountForThisPalpite = ZERO_DECIMAL;

          for (const base of baseMods) {
            const sub = computeFinalPayout({ modalidadeRaw: base, colocacaoRaw });
            if (!sub.ok) continue;

            const { factor } = checkVictory({ modal: base, palpites: [palpite], premios: premiosAllowed });

            if (factor > 0) {
              const winPart = perNumber
                .mul(stakeFactor)
                .mul(new Prisma.Decimal(String(sub.payout || 0)))
                .mul(new Prisma.Decimal(factor));

              if (isHybridMC) {
                amountForThisPalpite = amountForThisPalpite.add(winPart); // Soma (MC)
              } else {
                if (winPart.greaterThan(amountForThisPalpite)) amountForThisPalpite = winPart; // Max (padrão)
              }
            }
          }

          prize = prize.add(amountForThisPalpite);
        }
      } else {
        const isComposta = /DUQUE|TERNO|QUADRA|QUINA|PASSE|PALPITAO/.test(modalNorm);

        if (isComposta) {
          const { factor } = checkVictory({ modal: modalNorm, palpites, premios: premiosAllowed });
          if (factor > 0) {
            const amount = perNumber
              .mul(new Prisma.Decimal(String(payout || 0)))
              .mul(new Prisma.Decimal(factor));
            prize = prize.add(amount);
          }
        } else {
          const { factor, wins } = checkVictory({ modal: modalNorm, palpites, premios: premiosAllowed });

          if (factor > 0 && (!Array.isArray(wins) || wins.length === 0)) {
            console.warn(`[BET ${bet.id}] WIN_WITHOUT_WINS_FAIL_CLOSED (${modalNorm} @ ${colocacaoRaw})`);
            continue;
          }

          if (Array.isArray(wins) && wins.length) {
            for (const w of wins) {
              const amount = perNumber.mul(new Prisma.Decimal(String(payout || 0)));
              prize = prize.add(amount);
            }
          }
        }
      }
    }

    const finalPrize = prize.toDecimalPlaces(2);

    let newStatus = finalPrize.greaterThan(ZERO_DECIMAL) ? 'won' : 'lost';
    if (finalPrize.greaterThan(ZERO_DECIMAL) && (requiresManualReview || finalPrize.greaterThan(MAX_AUTO_PAYOUT_DEC))) {
      newStatus = 'pending_review';
    }

    const oldStatus = bet.status;
    const oldPrize = toDecimalMoney(bet.prize ?? 0);
    const hadPrizeCredit = Boolean(bet.prizeCreditedAt);

    const recheckAt = new Date();
    const outcome = await prisma.$transaction(async (tx) => {
      const lock = await tx.bet.updateMany({
        where: { id: bet.id, recheckedAt: null, status: bet.status, prize: bet.prize, settledAt: bet.settledAt },
        data: { recheckedAt: recheckAt },
      });
      if (!lock.count) return { already: true };

      if (newStatus === oldStatus && finalPrize.equals(oldPrize)) {
        return { noChange: true };
      }

      if (oldStatus === 'won' && oldPrize.greaterThan(ZERO_DECIMAL) && hadPrizeCredit) {
        await tx.user.update({ where: { id: bet.userId }, data: { balance: { decrement: oldPrize } } });
        await tx.transaction.create({
          data: {
            userId: bet.userId,
            type: 'adjustment',
            amount: oldPrize.negated(),
            description: `Estorno Correção (${bet.id})`,
          },
        });
      }

      await tx.bet.updateMany({
        where: { id: bet.id },
        data: {
          status: newStatus,
          prize: finalPrize,
          settledAt: new Date(),
          resultId: matchingResult.id,
          recheckedAt: recheckAt,
          prizeCreditedAt: null,
        },
      });

      if (newStatus === 'won' && finalPrize.greaterThan(ZERO_DECIMAL)) {
        const creditLock = await tx.bet.updateMany({
          where: { id: bet.id, prizeCreditedAt: null, status: 'won', prize: finalPrize },
          data: { prizeCreditedAt: new Date() },
        });
        if (creditLock.count) {
          await tx.user.update({ where: { id: bet.userId }, data: { balance: { increment: finalPrize } } });
          await tx.transaction.create({
            data: { userId: bet.userId, type: 'prize', amount: finalPrize, description: `Prêmio Recalculado (${bet.id})` },
          });
        }
      }

      return { updated: true };
    });

    if (outcome?.already) return res.status(409).json({ error: 'Recheck já processado.' });
    if (outcome?.noChange) return res.json({ message: `Aposta correta.`, bet, matchedResult: { id: matchingResult.id } });

    return res.json({
      message: 'Corrigido!',
      changes: {
        from: { status: oldStatus, prize: oldPrize.toFixed(2) },
        to: { status: newStatus, prize: finalPrize.toFixed(2) },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Erro interno.' });
  }
};

exports.getStats = exports.getDashboardStats;
exports.getDashboard = exports.getDashboardStats;
exports.getUsers = exports.listUsers;
exports.getBets = exports.listBets;
exports.getWithdrawals = exports.listWithdrawals;
exports.getResults = exports.listResults;
exports.getSupervisors = exports.listSupervisors;
exports.listCoupons = async (req, res) => {
  res.json({ coupons: [] });
};
exports.createCoupon = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};
exports.updateCoupon = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};
exports.getCoupons = exports.listCoupons;
