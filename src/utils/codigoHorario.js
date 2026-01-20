const normalizeLabel = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

const hasLetters = (s) => /[A-Z]/.test(normalizeLabel(s));

const codeKind = (label) => {
  const u = normalizeLabel(label);
  if (u.includes('MALUQ')) return 'MALUQ';
  if (u.includes('PT RIO')) return 'PT_RIO';
  if (u.includes('FEDERAL')) return 'FEDERAL';
  return 'UNKNOWN';
};

const isMaluqFederal = (label) => {
  const u = normalizeLabel(label);
  return u.includes('MALUQ') && u.includes('FEDERAL');
};

const normalizeCodigoHorarioLabel = (raw, loteria) => {
  if (!raw) return null;

  let label = normalizeLabel(raw);
  if (!label) return null;

  if (label.includes('-')) {
    const parts = label.split('-').map((p) => p.trim()).filter(Boolean);
    label = parts[parts.length - 1] || label;
  }

  const hasHourOnly = /^\d{1,2}HS$/.test(label);
  if (hasHourOnly && loteria) {
    label = `${normalizeLabel(loteria)} ${label}`.trim();
  }

  label = label.replace(/\b(\d)HS\b/, '0$1HS');

  return label;
};

const codesMatchStrict = (betCode, resultCode) => {
  const b = normalizeLabel(betCode);
  const r = normalizeLabel(resultCode);
  if (!b || !r) return false;

  const bHas = hasLetters(b);
  const rHas = hasLetters(r);
  if (!bHas && rHas) return false;

  if (bHas && rHas) return b === r;

  const bh = b.match(/(\d{1,2})/);
  const rh = r.match(/(\d{1,2})/);
  if (!bh || !rh) return false;
  return String(bh[1]).padStart(2, '0') === String(rh[1]).padStart(2, '0');
};

module.exports = {
  normalizeLabel,
  hasLetters,
  codeKind,
  codesMatchStrict,
  isMaluqFederal,
  normalizeCodigoHorarioLabel,
};
