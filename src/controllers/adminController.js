// src/controllers/adminController.js
// VERSÃO V34B - FINAL PRODUCTION (CENTRALIZED NORMALIZATION + PATCHED CONSISTENCY)
// - ARCH: Normalização da modalidade ocorre UMA VEZ (modalNorm) e é usada em TODO downstream.
// - FIX: PALPITÃO normaliza para PALPITAO (removendo acento), evitando drift.
// - FIX: expandModalidades reconhece PALPITAO (já normalizado) e compostas são consistentes.
// - CORE: Engine V3.3 (Hybrid Logic, Synced Recheck, Reconstitutable Audit).

const { Prisma } = require('@prisma/client');
const crypto = require('crypto');
const prisma = require('../utils/prismaClient');
const { recordTransaction } = require('../services/financeService');
const {
  normalizeLabel: normalizeHorarioLabel,
  hasLetters: horarioHasLetters,
  codeKind: codigoKind,
  codesMatchStrict,
  isMaluqFederal,
  normalizeCodigoHorarioLabel,
} = require('../utils/codigoHorario');

// --- CONSTANTES ---
const MAX_AUTO_PAYOUT = 10000; // Teto para aprovação automática
const AUDIT_LOGS = process.env.AUDIT_LOGS === '1'; // Controlado por ENV
const ADMIN_DEBUG = process.env.ADMIN_DEBUG === 'true';
const ZERO_DECIMAL = new Prisma.Decimal(0);
const MAX_AUTO_PAYOUT_DEC = new Prisma.Decimal(MAX_AUTO_PAYOUT);
const MANUAL_SETTLEMENT_MISSING = 'MANUAL_SETTLEMENT_MISSING';
const DASHBOARD_CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30000);
const DB_LOG_THRESHOLD_MS = Number(process.env.DB_LOG_THRESHOLD_MS || 600);
const SYSTEM_SETTING_BANK_BALANCE_KEY = 'bank_balance';

const DASHBOARD_CACHE = {
  data: null,
  etag: null,
  expiresAt: 0,
};

const setCacheHeaders = (res, etag) => {
  if (DASHBOARD_CACHE_TTL_MS > 0) {
    res.set('Cache-Control', `private, max-age=${Math.max(1, Math.floor(DASHBOARD_CACHE_TTL_MS / 1000))}`);
  }
  if (etag) res.set('ETag', etag);
};

const logDbTiming = (label, startedAt) => {
  const ms = Date.now() - startedAt;
  if (ms >= DB_LOG_THRESHOLD_MS) {
    console.log(`[DB] ${label} ${ms.toFixed(1)}ms`);
  }
  return ms;
};

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

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeName = (value) => String(value || '').trim();

const buildSupervisorMatch = (name, phone) => {
  const criteria = [];
  if (phone) criteria.push({ phone });
  if (name) criteria.push({ name });
  if (!criteria.length) return null;
  return { OR: criteria };
};

const makeSupervisorCodeSeed = (name) => {
  const seed = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return seed.slice(0, 4) || 'SUP';
};

const generateSupervisorCode = async (name) => {
  const base = makeSupervisorCodeSeed(name);
  for (let i = 0; i < 6; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${base}${suffix}`;
    const existing = await prisma.supervisor.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  return `${base}${Date.now().toString(36).slice(-6).toUpperCase()}`;
};

const isAdminRequest = (req) => Boolean(req?.user?.isAdmin || req?.isAdmin);
const getSupervisorScope = (req) => {
  if (req?.supervisor && !isAdminRequest(req)) return req.supervisor;
  return null;
};

const betHasTicketId = (() => {
  let cached;
  return () => {
    if (cached !== undefined) return cached;
    try {
      const model = prisma?._dmmf?.datamodel?.models?.find((m) => m.name === 'Bet');
      cached = Boolean(model?.fields?.some((f) => f.name === 'ticketId'));
    } catch {
      cached = false;
    }
    return cached;
  };
})();
// --- FUNÇÕES AUXILIARES ---
const isManualSettlementMissing = (err) => {
  const code = err?.code;
  const message = String(err?.message || '');
  const table = err?.meta?.table || err?.meta?.model || '';
  if (code === 'P2021') {
    return table === 'ManualSettlement' || message.includes('ManualSettlement');
  }
  return message.includes('ManualSettlement') && message.toLowerCase().includes('does not exist');
};

const ensureManualSettlementTable = async () => {
  try {
    await prisma.manualSettlement.findFirst({ select: { id: true } });
  } catch (err) {
    if (isManualSettlementMissing(err)) {
      const error = new Error(MANUAL_SETTLEMENT_MISSING);
      error.statusCode = 503;
      throw error;
    }
    throw err;
  }
};

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

const compareCodigoHorario = (betCode, resultCode) => {
  const betKind = codigoKind(betCode);
  const resultKind = codigoKind(resultCode);
  const betIsMaluqFederal = isMaluqFederal(betCode);
  const resultIsMaluqFederal = isMaluqFederal(resultCode);

  if (resultKind === 'FEDERAL') {
    if (betKind !== 'FEDERAL') return false;
    if (betIsMaluqFederal || resultIsMaluqFederal) return false;
  } else if (resultKind === 'MALUQ') {
    if (betKind !== 'MALUQ') return false;
    if (betIsMaluqFederal !== resultIsMaluqFederal) return false;
  } else if (resultKind === 'PT_RIO') {
    if (betKind !== 'PT_RIO') return false;
  } else {
    if (betKind !== 'UNKNOWN') return false;
  }

  return codesMatchStrict(betCode, resultCode);
};

const getCompareMode = (betCode, resultCode) => {
  const b = normalizeHorarioLabel(betCode);
  const r = normalizeHorarioLabel(resultCode);
  const bHas = horarioHasLetters(b);
  const rHas = horarioHasLetters(r);
  if (bHas && rHas) return b === r ? 'LABEL_STRICT' : 'LABEL_MISMATCH';
  if (!bHas && rHas) return 'LABEL_REQUIRED';
  const bh = b.match(/(\d{1,2})/);
  const rh = r.match(/(\d{1,2})/);
  if (bh && rh) return 'TIME_FALLBACK';
  return 'NO_MATCH';
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
  if (c.includes('MALUQ') && c.includes('FEDERAL')) return 'MALUQ FEDERAL';
  if (c.includes('MALUQ')) return 'MALUQUINHA';
  if (c.includes('RIO') && c.includes('FEDERAL')) return 'RIO/FEDERAL';
  if (c.includes('PTRIO') || c.includes('CORUJA') || c.includes('RIO')) return 'RIO/FEDERAL';
  if (c.includes('SAO') && c.includes('PAULO')) return 'SAO-PAULO';
  if (c.includes('BAND')) return 'SAO-PAULO';
  if (c.includes('PTSP')) return 'SAO-PAULO';
  if (c.includes('SP') && (c.includes('PT') || c.includes('LT'))) return 'SAO-PAULO';
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

const resolvePerNumberStake = (aposta, bet) => {
  const valPorNum = toDecimalMoney(aposta?.valorPorNumero);
  if (valPorNum.greaterThan(ZERO_DECIMAL)) return valPorNum;

  const palpites = Array.isArray(aposta?.palpites) ? aposta.palpites : [];
  const palpCount = palpites.length || 0;

  const valorAposta = toDecimalMoney(aposta?.valorAposta ?? aposta?.valor ?? aposta?.amount);
  const modoValor = String(aposta?.modoValor || '').trim().toLowerCase();
  if (valorAposta.greaterThan(ZERO_DECIMAL)) {
    if (modoValor === 'cada') return valorAposta;
    if (palpCount > 0) return valorAposta.div(new Prisma.Decimal(palpCount));
  }

  const rawTotal = aposta?.total !== undefined && aposta?.total !== null ? aposta.total : bet?.total;
  const betTotalNum = toDecimalMoney(rawTotal);
  if (palpCount > 0 && betTotalNum.greaterThan(ZERO_DECIMAL)) {
    return betTotalNum.div(new Prisma.Decimal(palpCount));
  }

  return ZERO_DECIMAL;
};

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

const parseResultNumbers = (result) => {
  let numeros = [];
  let grupos = [];
  try {
    numeros = Array.isArray(result.numeros) ? result.numeros : JSON.parse(result.numeros || '[]');
  } catch {
    numeros = [];
  }
  try {
    grupos = Array.isArray(result.grupos) ? result.grupos : JSON.parse(result.grupos || '[]');
  } catch {
    grupos = [];
  }
  return { numeros, grupos };
};

const buildPremios = (numeros) =>
  (Array.isArray(numeros) ? numeros : [])
    .map((n) => String(n).replace(/\D/g, '').slice(-4).padStart(4, '0'))
    .filter(Boolean);

const isKindMatch = (betCode, resultCode) => {
  const betKind = codigoKind(betCode);
  const resultKind = codigoKind(resultCode);
  const betMaluqFederal = isMaluqFederal(betCode);
  const resultMaluqFederal = isMaluqFederal(resultCode);

  if (betKind === 'PT_RIO') return resultKind === 'PT_RIO';
  if (betKind === 'MALUQ') return resultKind === 'MALUQ' && betMaluqFederal === resultMaluqFederal;
  if (betKind === 'FEDERAL') return resultKind === 'FEDERAL' && !resultMaluqFederal;
  if (betKind === 'UNKNOWN') return resultKind === 'UNKNOWN';
  return false;
};

const simulateBetAgainstResult = ({ bet, result }) => {
  const { numeros, grupos } = parseResultNumbers(result);
  const premios = buildPremios(numeros);
  if (!premios.length) {
    return {
      wouldWin: false,
      prize: '0.00',
      wins: [],
      reason: 'RESULTADO_SEM_NUMEROS',
      resultSnapshot: { numeros, grupos },
    };
  }

  const apostas = parseApostasFromBet(bet);
  if (!apostas.length) {
    return {
      wouldWin: false,
      prize: '0.00',
      wins: [],
      reason: 'APOSTA_SEM_LINHAS',
      resultSnapshot: { numeros, grupos },
    };
  }

  let prize = ZERO_DECIMAL;
  let requiresManualReview = false;
  const wins = [];

  apostas.forEach((aposta, apostaIndex) => {
    const modalSrc = aposta.modalidade || bet.modalidade || '';
    const modalNorm = normalizeModalidade(modalSrc);
    const colocacaoRaw = String(aposta.colocacao || bet.colocacao || '').trim();
    const palpites = Array.isArray(aposta.palpites) ? aposta.palpites : [];
    const palpCount = palpites.length || 0;
    const perNumber = resolvePerNumberStake(aposta, bet);

    if (!perNumber.greaterThan(ZERO_DECIMAL) || !palpCount) {
      wins.push({
        apostaIndex,
        modalidade: modalNorm,
        colocacao: colocacaoRaw,
        matched: [],
        payout: '0',
        reason: 'VALOR_INVALIDO',
      });
      return;
    }

    if (modalNorm.includes('PASSE') || modalNorm.includes('PALPITAO')) {
      requiresManualReview = true;
    }

    const { ok, payout, reason } = computeFinalPayout({ modalidadeRaw: modalNorm, colocacaoRaw });
    if (!ok) {
      wins.push({
        apostaIndex,
        modalidade: modalNorm,
        colocacao: colocacaoRaw,
        matched: [],
        payout: '0',
        reason,
      });
      return;
    }

    const allowedIdx = indicesFromColocacao(colocacaoRaw);
    if (!allowedIdx.length) {
      wins.push({
        apostaIndex,
        modalidade: modalNorm,
        colocacao: colocacaoRaw,
        matched: [],
        payout: String(payout || 0),
        reason: 'COLOCACAO_INVALIDA',
      });
      return;
    }

    const premiosAllowed = allowedIdx.map((i) => premios[i]).filter(Boolean);
    if (!premiosAllowed.length) {
      wins.push({
        apostaIndex,
        modalidade: modalNorm,
        colocacao: colocacaoRaw,
        matched: [],
        payout: String(payout || 0),
        reason: 'SEM_PREMIOS',
      });
      return;
    }

    const baseMods = expandModalidades(modalNorm);
    const matched = new Set();
    let linePrize = ZERO_DECIMAL;

    if (baseMods.length > 1 && !baseMods.includes('COMPOSTA') && !baseMods.includes('UNKNOWN')) {
      const isHybridMC = baseMods.length === 2 &&
        baseMods.includes('MILHAR') &&
        baseMods.includes('CENTENA');
      const stakeFactor = isHybridMC ? new Prisma.Decimal('0.5') : new Prisma.Decimal(1);

      for (const palpite of palpites) {
        let amountForThisPalpite = ZERO_DECIMAL;
        let palpiteMatched = false;

        for (const base of baseMods) {
          const sub = computeFinalPayout({ modalidadeRaw: base, colocacaoRaw });
          if (!sub.ok) continue;
          const { factor, wins: subWins } = checkVictory({ modal: base, palpites: [palpite], premios: premiosAllowed });
          if (factor > 0) {
            palpiteMatched = true;
            if (Array.isArray(subWins)) subWins.forEach((w) => matched.add(w));
            const winPart = perNumber
              .mul(stakeFactor)
              .mul(new Prisma.Decimal(String(sub.payout || 0)))
              .mul(new Prisma.Decimal(factor));
            amountForThisPalpite = amountForThisPalpite.add(winPart);
          }
        }

        if (palpiteMatched) matched.add(palpite);
        linePrize = linePrize.add(amountForThisPalpite);
      }
    } else {
      const isComposta = /DUQUE|TERNO|QUADRA|QUINA|PASSE|PALPITAO/.test(modalNorm);

      if (isComposta) {
        const { factor, hits } = checkVictory({ modal: modalNorm, palpites, premios: premiosAllowed });
        if (factor > 0) {
          const amount = perNumber
            .mul(new Prisma.Decimal(String(payout || 0)))
            .mul(new Prisma.Decimal(factor));
          linePrize = linePrize.add(amount);
          if (Array.isArray(hits)) hits.forEach((h) => matched.add(h));
        }
      } else {
        const { factor, wins: lineWins } = checkVictory({ modal: modalNorm, palpites, premios: premiosAllowed });
        if (factor > 0 && Array.isArray(lineWins)) {
          lineWins.forEach((w) => {
            matched.add(w);
            const amount = perNumber.mul(new Prisma.Decimal(String(payout || 0)));
            linePrize = linePrize.add(amount);
          });
        }
      }
    }

    prize = prize.add(linePrize);

    wins.push({
      apostaIndex,
      modalidade: modalNorm,
      colocacao: colocacaoRaw,
      matched: Array.from(matched),
      payout: String(payout || 0),
      prize: linePrize.toDecimalPlaces(2).toFixed(2),
      reason: matched.size ? null : 'SEM_ACERTO',
    });
  });

  const finalPrize = prize.toDecimalPlaces(2);
  return {
    wouldWin: finalPrize.greaterThan(ZERO_DECIMAL),
    prize: finalPrize.toFixed(2),
    wins,
    requiresManualReview,
    resultSnapshot: { numeros, grupos },
  };
};

// ==========================================
// CONTROLLERS
// ==========================================

exports.getDashboardStats = async (req, res) => {
  try {
    const now = Date.now();
    if (DASHBOARD_CACHE.data && now < DASHBOARD_CACHE.expiresAt) {
      setCacheHeaders(res, DASHBOARD_CACHE.etag);
      if (req.headers['if-none-match'] && req.headers['if-none-match'] === DASHBOARD_CACHE.etag) {
        return res.status(304).end();
      }
      return res.json(DASHBOARD_CACHE.data);
    }

    const startedAt = Date.now();
    const [usersAgg, betsAgg, withdrawalsAgg, betsCount, totalUsers, wonAgg, bankBalanceSetting] = await Promise.all([
      prisma.user.aggregate({ where: { deletedAt: null }, _sum: { balance: true, bonus: true } }),
      prisma.bet.aggregate({ _sum: { total: true } }),
      prisma.withdrawalRequest.aggregate({ where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.bet.count(),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.bet.aggregate({ where: { status: 'won' }, _sum: { prize: true } }),
      prisma.systemSetting.findUnique({
        where: { key: SYSTEM_SETTING_BANK_BALANCE_KEY },
        select: { value: true },
      }),
    ]);
    logDbTiming('admin_stats', startedAt);
    const payload = {
      totalUsers, betsCount,
      platformFunds: Number(betsAgg._sum.total || 0),
      moneyOut: { bets: Number(betsAgg._sum.total || 0) },
      wallets: { saldo: Number(usersAgg._sum.balance || 0), bonus: Number(usersAgg._sum.bonus || 0), total: Number(usersAgg._sum.balance || 0) + Number(usersAgg._sum.bonus || 0) },
      pendingWithdrawals: { amount: Number(withdrawalsAgg._sum.amount || 0), count: withdrawalsAgg._count?._all || 0 },
      totalPaidPrizes: Number(wonAgg._sum.prize || 0),
      bankBalance: toNumberSafe(bankBalanceSetting?.value),
    };
    const etag = `W/\"${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex')}\"`;
    DASHBOARD_CACHE.data = payload;
    DASHBOARD_CACHE.etag = etag;
    DASHBOARD_CACHE.expiresAt = Date.now() + DASHBOARD_CACHE_TTL_MS;
    setCacheHeaders(res, etag);
    if (req.headers['if-none-match'] && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.json(payload);
  } catch (error) { res.json({}); }
};

exports.getBankBalance = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SYSTEM_SETTING_BANK_BALANCE_KEY },
      select: { value: true, updatedAt: true },
    });
    return res.json({
      value: toNumberSafe(setting?.value),
      updatedAt: setting?.updatedAt || null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar saldo bancário.' });
  }
};

exports.setBankBalance = async (req, res) => {
  const rawValue = req.body?.value;
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return res.status(400).json({ error: 'Informe um valor válido.' });
  }

  const parsedValue = toNumberSafe(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return res.status(400).json({ error: 'Valor inválido para saldo bancário.' });
  }

  try {
    const saved = await prisma.systemSetting.upsert({
      where: { key: SYSTEM_SETTING_BANK_BALANCE_KEY },
      update: { value: parsedValue.toFixed(2) },
      create: { key: SYSTEM_SETTING_BANK_BALANCE_KEY, value: parsedValue.toFixed(2) },
      select: { key: true, value: true, updatedAt: true },
    });
    return res.json({
      key: saved.key,
      value: toNumberSafe(saved.value),
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao salvar saldo bancário.' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const supervisorScope = getSupervisorScope(req);
    const baseWhere = { deletedAt: null };
    const where = supervisorScope ? { ...baseWhere, supervisorId: supervisorScope.id } : baseWhere;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: 50,
        skip: (page - 1) * 50,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, phone: true, balance: true, bonus: true, cpf: true, isAdmin: true, email: true, isBlocked: true },
      }),
      prisma.user.count({ where }),
    ]);

    if (!users.length) {
      return res.json({ users, total, page });
    }

    const userIds = users.map((u) => u.id).filter(Boolean);
    const phones = users.map((u) => normalizePhone(u.phone)).filter(Boolean);
    const names = users.map((u) => normalizeName(u.name)).filter(Boolean);
    let supervisors = [];
    if (userIds.length || phones.length || names.length) {
      const criteria = [];
      if (userIds.length) criteria.push({ userId: { in: userIds } });
      if (phones.length) criteria.push({ phone: { in: phones } });
      if (names.length) criteria.push({ name: { in: names } });
      supervisors = await prisma.supervisor.findMany({
        where: { OR: criteria },
        select: { phone: true, name: true, userId: true },
      });
    }

    const supervisorUserIds = new Set(supervisors.map((s) => s.userId).filter(Boolean));
    const supervisorPhones = new Set(supervisors.map((s) => normalizePhone(s.phone)));
    const supervisorNames = new Set(supervisors.map((s) => normalizeName(s.name)));

    const usersWithFlags = users.map((user) => ({
      ...user,
      isSupervisor:
        (user.id && supervisorUserIds.has(user.id)) ||
        (user.phone && supervisorPhones.has(normalizePhone(user.phone))) ||
        (user.name && supervisorNames.has(normalizeName(user.name))),
    }));

    return res.json({ users: usersWithFlags, total, page });
  } catch(e) { res.status(500).json({error: 'Erro list users'}); }
};

exports.getUserTransactions = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const supervisorScope = getSupervisorScope(req);
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, balance: true, bonus: true, supervisorId: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (supervisorScope && user.supervisorId !== supervisorScope.id) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const [transactions, withdrawals] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, type: true, amount: true, description: true, createdAt: true },
      }),
      prisma.withdrawalRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, amount: true, status: true, createdAt: true, pixKey: true },
      }),
    ]);

    const history = [
      ...transactions.map((t) => ({
        id: `tx-${t.id}`,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
        source: 'transaction',
      })),
      ...withdrawals.map((w) => ({
        id: `wd-${w.id}`,
        type: 'withdrawal',
        amount: toDecimalMoney(w.amount).negated(),
        description: `Saque (${w.status})${w.pixKey ? ` - ${w.pixKey}` : ''}`,
        createdAt: w.createdAt,
        source: 'withdrawal',
        status: w.status,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ user, history });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

exports.updateUserRoles = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const { isAdmin, makeSupervisor } = req.body || {};
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, isAdmin: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    let updatedUser = user;
    if (typeof isAdmin === 'boolean' && isAdmin !== user.isAdmin) {
      updatedUser = await prisma.user.update({
        where: { id },
        data: { isAdmin },
        select: { id: true, name: true, phone: true, isAdmin: true },
      });
    }

    let supervisor = null;
    let isSupervisor = false;

    if (makeSupervisor) {
      const phone = normalizePhone(updatedUser.phone);
      const name = normalizeName(updatedUser.name);
      supervisor = await prisma.supervisor.findUnique({ where: { userId: updatedUser.id } });
      if (!supervisor) {
        const where = buildSupervisorMatch(name, phone);
        if (where) {
          supervisor = await prisma.supervisor.findFirst({ where });
        }
      }
      if (!supervisor) {
        const code = await generateSupervisorCode(name);
        supervisor = await prisma.supervisor.create({
          data: { name: name || updatedUser.name, phone: phone || null, code, userId: updatedUser.id },
        });
      } else if (!supervisor.userId || supervisor.userId !== updatedUser.id) {
        supervisor = await prisma.supervisor.update({
          where: { id: supervisor.id },
          data: { userId: updatedUser.id },
        });
      }
      isSupervisor = true;
    } else {
      const phone = normalizePhone(updatedUser.phone);
      const name = normalizeName(updatedUser.name);
      supervisor = await prisma.supervisor.findUnique({ where: { userId: updatedUser.id } });
      if (!supervisor) {
        const where = buildSupervisorMatch(name, phone);
        if (where) {
          supervisor = await prisma.supervisor.findFirst({ where });
        }
      }
      isSupervisor = !!supervisor;
    }

    return res.json({ user: { ...updatedUser, isSupervisor }, supervisor });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao atualizar papéis do usuário.' });
  }
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
    const pageSizeRaw = Number(req.query.pageSize) || 50;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
    const rawStatuses = String(req.query.statuses || req.query.status || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const supervisorScope = getSupervisorScope(req);
    const where = supervisorScope ? { user: { supervisorId: supervisorScope.id } } : {};
    if (rawStatuses.length) {
      where.status = { in: rawStatuses };
    }
    const bets = await prisma.bet.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, phone: true } } },
    });
    const total = await prisma.bet.count({ where });
    res.json({ bets, total, page, pageSize });
  } catch (e) { res.status(500).json({ error: 'Erro bets' }); }
};

exports.getBetPuleData = async (req, res) => {
  try {
    const rawId = String(req.params.ticketId || req.params.id || '').trim();
    if (!rawId) return res.status(400).json({ error: 'Parâmetro inválido.' });

    const hasTicketId = betHasTicketId();
    const numericId = Number(rawId);
    const canUseNumeric = Number.isFinite(numericId) && numericId > 0;

    let baseBet = null;
    if (canUseNumeric) {
      baseBet = await prisma.bet.findUnique({
        where: { id: numericId },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
    }

    if (!baseBet && hasTicketId) {
      baseBet = await prisma.bet.findFirst({
        where: { ticketId: rawId },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, phone: true } } },
      });
    }

    if (!baseBet) return res.status(404).json({ error: 'Aposta não encontrada.' });

    let bets = [baseBet];
    if (hasTicketId && baseBet.ticketId) {
      bets = await prisma.bet.findMany({
        where: { ticketId: baseBet.ticketId },
        orderBy: { createdAt: 'asc' },
      });
    }

    const headerBet = bets[0] || baseBet;
    const apostas = bets.flatMap((bet) => parseApostasFromBet(bet));
    const total = bets.reduce((acc, bet) => acc.add(toDecimalSafe(bet.total)), ZERO_DECIMAL).toDecimalPlaces(2);
    const ticketRef = baseBet.ticketId ? `TICKET-${String(baseBet.ticketId).slice(0, 8)}` : null;

    return res.json({
      id: baseBet.ticketId || baseBet.id,
      ticketId: baseBet.ticketId || null,
      betRef: ticketRef || `${baseBet.userId || ''}-${baseBet.id || ''}`,
      loteria: headerBet.loteria,
      codigoHorario: headerBet.codigoHorario,
      dataJogo: headerBet.dataJogo,
      createdAt: headerBet.createdAt,
      userId: baseBet.userId,
      total: total.toFixed(2),
      apostas,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao buscar dados da PULE.' });
  }
};

exports.listWithdrawals = async (req, res) => {
  try {
    const supervisorScope = getSupervisorScope(req);
    const where = supervisorScope ? { user: { supervisorId: supervisorScope.id } } : {};
    const withdrawals = await prisma.withdrawalRequest.findMany({ 
        where,
        orderBy: { createdAt: 'desc' }, 
        include: { user: { select: { name: true, phone: true } } } 
    });
    res.json({ withdrawals });
  } catch (e) { res.json({ withdrawals: [] }); }
};

exports.getPendingNotificationsCount = async (req, res) => {
  try {
    const supervisorScope = getSupervisorScope(req);
    const where = supervisorScope
      ? { status: 'pending', user: { supervisorId: supervisorScope.id } }
      : { status: 'pending' };

    const betSinceRaw = String(req.query?.betSince || req.query?.betsSince || '').trim();
    let betSince = null;
    if (betSinceRaw) {
      const parsed = new Date(betSinceRaw);
      if (!Number.isNaN(parsed.getTime())) {
        betSince = parsed;
      }
    }

    const betsWhere = {
      ...(supervisorScope ? { user: { supervisorId: supervisorScope.id } } : {}),
      ...(betSince ? { createdAt: { gt: betSince } } : {}),
    };

    const startedAt = Date.now();
    const [withdrawalsCount, betsNew] = await Promise.all([
      prisma.withdrawalRequest.count({ where }),
      betSince ? prisma.bet.count({ where: betsWhere }) : Promise.resolve(0),
    ]);
    logDbTiming('admin_notifications', startedAt);

    return res.json({
      withdrawals: withdrawalsCount,
      betsNew,
      total: withdrawalsCount + betsNew,
    });
  } catch (error) {
    console.error('Erro ao contar notificacoes:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar contagem.' });
  }
};

exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const statusRaw = String(req.body?.status || '').trim().toLowerCase();
    const allowedStatuses = ['pending', 'approved', 'rejected', 'paid'];
    if (!allowedStatuses.includes(statusRaw)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id },
        select: { id: true, userId: true, amount: true, status: true },
      });

      if (!request) {
        const err = new Error('Saque não encontrado.');
        err.code = 'ERR_NOT_FOUND';
        throw err;
      }

      const currentStatus = String(request.status || '').toLowerCase();
      if (currentStatus === statusRaw) return request;

      if (statusRaw === 'approved') {
        if (currentStatus !== 'pending') {
          const err = new Error('Apenas saques pendentes podem ser aprovados.');
          err.code = 'ERR_INVALID_STATE';
          throw err;
        }
        return tx.withdrawalRequest.update({
          where: { id },
          data: { status: 'approved' },
        });
      }

      if (statusRaw === 'paid') {
        if (currentStatus !== 'approved') {
          const err = new Error('Apenas saques aprovados podem ser marcados como pagos.');
          err.code = 'ERR_INVALID_STATE';
          throw err;
        }
        return tx.withdrawalRequest.update({
          where: { id },
          data: { status: 'paid' },
        });
      }

      if (statusRaw === 'rejected') {
        if (currentStatus === 'paid') {
          const err = new Error('Não é possível rejeitar um saque já pago.');
          err.code = 'ERR_INVALID_STATE';
          throw err;
        }

        await tx.withdrawalRequest.update({
          where: { id },
          data: { status: 'rejected' },
        });

        await tx.user.update({
          where: { id: request.userId },
          data: { balance: { increment: request.amount } },
        });

        await recordTransaction({
          userId: request.userId,
          type: 'withdraw_reject',
          amount: request.amount,
          description: `Saque ${request.id} rejeitado`,
          client: tx,
          suppressErrors: false,
        });

        return { ...request, status: 'rejected' };
      }

      return request;
    });

    return res.json({ ok: true, withdrawal: result });
  } catch (e) {
    if (e?.code === 'ERR_NOT_FOUND') return res.status(404).json({ error: e.message });
    if (e?.code === 'ERR_INVALID_STATE') return res.status(400).json({ error: e.message });
    return res.status(500).json({ error: 'Erro ao atualizar saque.' });
  }
};

exports.listSupervisors = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const supervisorScope = getSupervisorScope(req);
    const where = supervisorScope ? { id: supervisorScope.id } : {};
    const supervisors = await prisma.supervisor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      include: { users: { select: { id: true, name: true, phone: true } } },
    });
    const total = await prisma.supervisor.count({ where });
    res.json({ supervisors, total, page });
  } catch (e) { res.json({ supervisors: [], total: 0 }); }
};

exports.createSupervisor = async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ error: 'Acesso restrito.' });
    const name = normalizeName(req.body?.name);
    const phone = normalizePhone(req.body?.phone);
    const userIdRaw = req.body?.userId;
    const userId = userIdRaw !== undefined && userIdRaw !== null && userIdRaw !== ''
      ? Number(userIdRaw)
      : null;
    const commissionRate = req.body?.commissionRate;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
    if (userId !== null && (!Number.isFinite(userId) || userId <= 0)) {
      return res.status(400).json({ error: 'userId inválido.' });
    }

    let commissionRateDecimal = null;
    if (commissionRate !== undefined && commissionRate !== null && commissionRate !== '') {
      try {
        commissionRateDecimal = new Prisma.Decimal(String(commissionRate));
      } catch {
        return res.status(400).json({ error: 'commissionRate inválido.' });
      }
      if (commissionRateDecimal.lessThan(ZERO_DECIMAL) || commissionRateDecimal.greaterThan(new Prisma.Decimal(100))) {
        return res.status(400).json({ error: 'commissionRate deve estar entre 0 e 100.' });
      }
    }

    const where = buildSupervisorMatch(name, phone);
    if (where) {
      const existing = await prisma.supervisor.findFirst({ where });
      if (existing) {
        return res.status(409).json({ error: 'Supervisor já cadastrado.' });
      }
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      const existingAccount = await prisma.supervisor.findUnique({ where: { userId } });
      if (existingAccount) return res.status(409).json({ error: 'Usuário já vinculado a outro supervisor.' });
    }

    const code = await generateSupervisorCode(name);
    const supervisor = await prisma.supervisor.create({
      data: {
        name,
        phone: phone || null,
        code,
        userId: userId || null,
        commissionRate: commissionRateDecimal,
      },
    });
    return res.status(201).json(supervisor);
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao cadastrar supervisor.' });
  }
};

exports.updateSupervisor = async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ error: 'Acesso restrito.' });
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const name = normalizeName(req.body?.name);
    const phone = normalizePhone(req.body?.phone);
    const userIdRaw = req.body?.userId;
    const userId = userIdRaw !== undefined && userIdRaw !== null && userIdRaw !== ''
      ? Number(userIdRaw)
      : null;
    const commissionRate = req.body?.commissionRate;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório.' });
    if (userId !== null && (!Number.isFinite(userId) || userId <= 0)) {
      return res.status(400).json({ error: 'userId inválido.' });
    }

    let commissionRateDecimal = null;
    if (commissionRate !== undefined && commissionRate !== null && commissionRate !== '') {
      try {
        commissionRateDecimal = new Prisma.Decimal(String(commissionRate));
      } catch {
        return res.status(400).json({ error: 'commissionRate inválido.' });
      }
      if (commissionRateDecimal.lessThan(ZERO_DECIMAL) || commissionRateDecimal.greaterThan(new Prisma.Decimal(100))) {
        return res.status(400).json({ error: 'commissionRate deve estar entre 0 e 100.' });
      }
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      const existingAccount = await prisma.supervisor.findFirst({ where: { userId, NOT: { id } } });
      if (existingAccount) return res.status(409).json({ error: 'Usuário já vinculado a outro supervisor.' });
    }

    const updated = await prisma.supervisor.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        userId: userId || null,
        commissionRate: commissionRateDecimal,
      },
    });
    return res.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return res.status(404).json({ error: 'Supervisor não encontrado.' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar supervisor.' });
  }
};

exports.deleteSupervisor = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    await prisma.supervisor.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return res.status(404).json({ error: 'Supervisor não encontrado.' });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return res.status(409).json({ error: 'Supervisor possui registros vinculados.' });
    }
    return res.status(500).json({ error: 'Erro ao excluir supervisor.' });
  }
};

exports.createResult = async (req, res) => {
  try {
    const { loteria, dataJogo, codigoHorario, numeros, grupos } = req.body;
    const codigoHorarioNorm = normalizeCodigoHorarioLabel(codigoHorario, loteria) || codigoHorario;

    const result = await prisma.result.create({
      data: { 
        loteria, dataJogo, codigoHorario: codigoHorarioNorm, 
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
    if (data.codigoHorario) {
      data.codigoHorario = normalizeCodigoHorarioLabel(data.codigoHorario, data.loteria) || data.codigoHorario;
    }
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
  if (ADMIN_DEBUG) {
    console.log(`\n🚀 [V34B-SETTLE] LIQUIDANDO RESULTADO ID: ${id}`);
  }

  try {
    const result = await prisma.result.findUnique({ where: { id } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado' });

    const resDate = normalizeDate(result.dataJogo);

    if (!isValidISODate(resDate)) {
      return res.status(400).json({ error: 'Resultado com Data inválida.' });
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
        if (!isValidISODate(betDate)) continue;
        if (betDate !== resDate) continue;
        if (!compareCodigoHorario(bet.codigoHorario, result.codigoHorario)) continue;

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

          const palpCount = palpites.length || 0;
          const perNumber = resolvePerNumberStake(aposta, bet);

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
  if (ADMIN_DEBUG) {
    console.log(`\n🕵️ [V34B-RECHECK] Aposta ID: ${betId}`);
  }

  try {
    const bet = await prisma.bet.findUnique({ where: { id: betId }, include: { user: true } });
    if (!bet) return res.status(404).json({ error: 'Aposta não encontrada' });
    if (bet.recheckedAt) return res.status(409).json({ error: 'Recheck já processado.' });

    const betDateISO = normalizeDate(bet.dataJogo);
    if (!isValidISODate(betDateISO)) return res.status(400).json({ error: 'Data inválida' });

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
      if (rDate !== betDateISO) continue;
      if (!compareCodigoHorario(bet.codigoHorario, r.codigoHorario)) continue;

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

      const palpCount = palpites.length || 0;
      const perNumber = resolvePerNumberStake(aposta, bet);

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

exports.listManualCompareCandidates = async (req, res) => {
  const betId = Number(req.params.betId || req.params.id);
  if (!betId) return res.status(400).json({ error: 'ID inválido.' });

  try {
    await ensureManualSettlementTable();
    const bet = await prisma.bet.findUnique({ where: { id: betId } });
    if (!bet) return res.status(404).json({ error: 'Aposta não encontrada.' });

    const betDateISO = normalizeDate(bet.dataJogo);
    if (!isValidISODate(betDateISO)) {
      return res.status(400).json({ error: 'Data inválida.' });
    }

    const [ano, mes, dia] = betDateISO.split('-');
    const betDateBR = `${dia}/${mes}/${ano}`;

    const candidatesFull = await prisma.result.findMany({
      where: {
        OR: [
          { dataJogo: { contains: betDateISO } },
          { dataJogo: { contains: betDateBR } },
          { dataJogo: String(bet.dataJogo) },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const betLabel = normalizeHorarioLabel(bet.codigoHorario);
    const betHasLetters = horarioHasLetters(betLabel);
    const betHour = betHasLetters ? 'XX' : extractHour(betLabel);
    const filtered = candidatesFull
      .filter((r) => normalizeDate(r.dataJogo) === betDateISO)
      .filter((r) => isKindMatch(bet.codigoHorario, r.codigoHorario));

    const sorted = filtered.sort((a, b) => {
      const aLabel = normalizeHorarioLabel(a.codigoHorario);
      const bLabel = normalizeHorarioLabel(b.codigoHorario);
      const aExact = aLabel === betLabel ? 1 : 0;
      const bExact = bLabel === betLabel ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      let aHourMatch = 0;
      let bHourMatch = 0;
      if (!betHasLetters && betHour !== 'XX') {
        const aHasLetters = horarioHasLetters(aLabel);
        const bHasLetters = horarioHasLetters(bLabel);
        if (!aHasLetters) {
          const aHour = extractHour(aLabel);
          if (aHour !== 'XX' && aHour === betHour) aHourMatch = 1;
        }
        if (!bHasLetters) {
          const bHour = extractHour(bLabel);
          if (bHour !== 'XX' && bHour === betHour) bHourMatch = 1;
        }
      }
      if (aHourMatch !== bHourMatch) return bHourMatch - aHourMatch;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const candidates = sorted.map((r) => ({
      resultId: r.id,
      loteria: r.loteria,
      codigoHorario: r.codigoHorario,
      dataJogo: r.dataJogo,
      createdAt: r.createdAt,
    }));

    return res.json({
      bet: {
        id: bet.id,
        userId: bet.userId,
        codigoHorario: bet.codigoHorario,
        dataJogo: bet.dataJogo,
        loteria: bet.loteria,
        apostas: parseApostasFromBet(bet),
      },
      candidates,
    });
  } catch (err) {
    if (err?.message === MANUAL_SETTLEMENT_MISSING || err?.statusCode === 503 || isManualSettlementMissing(err)) {
      return res.status(503).json({ error: 'ManualSettlement table missing – run DB patch' });
    }
    return res.status(500).json({ error: err?.message || 'Erro interno.' });
  }
};

exports.manualCompareBet = async (req, res) => {
  const betId = Number(req.params.betId || req.params.id);
  const resultId = Number(req.body?.resultId);
  if (!betId || !resultId) return res.status(400).json({ error: 'Parâmetros inválidos.' });

  try {
    await ensureManualSettlementTable();
    const bet = await prisma.bet.findUnique({ where: { id: betId } });
    if (!bet) return res.status(404).json({ error: 'Aposta não encontrada.' });

    const adminUserId = req.user?.id || req.userId;
    if (!adminUserId) return res.status(400).json({ error: 'Admin inválido.' });

    const result = await prisma.result.findUnique({ where: { id: resultId } });
    if (!result) return res.status(404).json({ error: 'Resultado não encontrado.' });

    const betDateISO = normalizeDate(bet.dataJogo);
    const resultDateISO = normalizeDate(result.dataJogo);
    if (!isValidISODate(betDateISO) || betDateISO !== resultDateISO) {
      return res.status(400).json({ error: 'Data não compatível.' });
    }

    const compareMode = getCompareMode(bet.codigoHorario, result.codigoHorario);
    const codesOk = compareCodigoHorario(bet.codigoHorario, result.codigoHorario);
    if (!codesOk) {
      return res.status(400).json({ error: 'Código horário incompatível.' });
    }

    const simulation = simulateBetAgainstResult({ bet, result });
    const resultSnapshot = parseResultNumbers(result);

    return res.json({
      betId: bet.id,
      resultId: result.id,
      wouldWin: simulation.wouldWin,
      prize: simulation.prize,
      wins: simulation.wins,
      reason: simulation.reason || null,
      debug: {
        betCodigo: bet.codigoHorario,
        resultCodigo: result.codigoHorario,
        compareMode,
      },
      result: {
        id: result.id,
        loteria: result.loteria,
        codigoHorario: result.codigoHorario,
        dataJogo: result.dataJogo,
        numeros: resultSnapshot.numeros,
        grupos: resultSnapshot.grupos,
      },
    });
  } catch (err) {
    if (err?.message === MANUAL_SETTLEMENT_MISSING || err?.statusCode === 503 || isManualSettlementMissing(err)) {
      return res.status(503).json({ error: 'ManualSettlement table missing – run DB patch' });
    }
    return res.status(500).json({ error: err?.message || 'Erro interno.' });
  }
};

exports.manualSettleBet = async (req, res) => {
  const betId = Number(req.params.betId || req.params.id);
  const resultId = Number(req.body?.resultId);
  const action = String(req.body?.action || '').toUpperCase();
  const reason = String(req.body?.reason || '').trim();
  const forcePrize = req.body?.forcePrize;

  if (!betId || !resultId || !action) return res.status(400).json({ error: 'Parâmetros inválidos.' });
  if (!reason) return res.status(400).json({ error: 'Reason obrigatório.' });
  if (action !== 'PAY') return res.status(400).json({ error: 'Ação inválida.' });

  const adminUserId = req.user?.id || req.userId;
  if (!adminUserId) return res.status(400).json({ error: 'Admin inválido.' });

  try {
    await ensureManualSettlementTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findUnique({ where: { id: betId } });
      if (!bet) throw new Error('BET_NOT_FOUND');

      const result = await tx.result.findUnique({ where: { id: resultId } });
      if (!result) throw new Error('RESULT_NOT_FOUND');

      const betDateISO = normalizeDate(bet.dataJogo);
      const resultDateISO = normalizeDate(result.dataJogo);
      if (!isValidISODate(betDateISO) || betDateISO !== resultDateISO) {
        throw new Error('DATA_INCOMPATIVEL');
      }

      if (!compareCodigoHorario(bet.codigoHorario, result.codigoHorario)) {
        throw new Error('CODIGO_INCOMPATIVEL');
      }

      const alreadyPaid = bet.status === 'paid' || bet.prizeCreditedAt;
      if (alreadyPaid) throw new Error('ALREADY_PAID');

      const existingManualPay = await tx.manualSettlement.findFirst({
        where: { betId: bet.id, action: 'PAY' },
      });
      if (existingManualPay) throw new Error('ALREADY_PAID');

      const simulation = simulateBetAgainstResult({ bet, result });
      const computedPrize = toDecimalMoney(simulation.prize);
      const finalPrize = forcePrize !== null && forcePrize !== undefined
        ? toDecimalMoney(forcePrize)
        : computedPrize;

      if (!finalPrize.greaterThan(ZERO_DECIMAL) || !simulation.wouldWin) {
        throw new Error('NOT_WINNER');
      }

      const now = new Date();
      const resultSnapshot = parseResultNumbers(result);
      const betSnapshot = {
        id: bet.id,
        loteria: bet.loteria,
        codigoHorario: bet.codigoHorario,
        dataJogo: bet.dataJogo,
        apostas: parseApostasFromBet(bet),
      };

      await tx.bet.updateMany({
        where: { id: bet.id },
        data: {
          status: 'paid',
          prize: finalPrize,
          settledAt: now,
          resultId: result.id,
          prizeCreditedAt: now,
        },
      });

      await tx.user.update({
        where: { id: bet.userId },
        data: { balance: { increment: finalPrize } },
      });

      await recordTransaction({
        client: tx,
        userId: bet.userId,
        type: 'prize',
        amount: finalPrize,
        description: `Prêmio manual (${bet.id})`,
        suppressErrors: false,
      });

      await tx.manualSettlement.create({
        data: {
          betId: bet.id,
          resultId: result.id,
          adminUserId,
          reason,
          prize: finalPrize,
          action,
          snapshotBet: betSnapshot,
          snapshotResult: resultSnapshot,
        },
      });

      return { prize: finalPrize.toFixed(2) };
    });

    return res.json({ ok: true, betId, resultId, prize: outcome.prize });
  } catch (err) {
    const message = err?.message || '';
    if (message === MANUAL_SETTLEMENT_MISSING || err?.statusCode === 503 || isManualSettlementMissing(err)) {
      return res.status(503).json({ error: 'ManualSettlement table missing – run DB patch' });
    }
    if (message === 'BET_NOT_FOUND') return res.status(404).json({ error: 'Aposta não encontrada.' });
    if (message === 'RESULT_NOT_FOUND') return res.status(404).json({ error: 'Resultado não encontrado.' });
    if (message === 'DATA_INCOMPATIVEL') return res.status(400).json({ error: 'Data não compatível.' });
    if (message === 'CODIGO_INCOMPATIVEL') return res.status(400).json({ error: 'Código horário incompatível.' });
    if (message === 'ALREADY_PAID') return res.status(409).json({ error: 'Pagamento manual já processado.' });
    if (message === 'NOT_WINNER') return res.status(400).json({ error: 'Aposta não premiada para pagamento.' });
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
