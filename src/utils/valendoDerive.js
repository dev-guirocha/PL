// utils/valendoDerive.js
// Engine pura de derivacao do VALENDO.
// Entrada: milhares base (string[]) + modalidade destino (string)
// Saida: palpites derivados (string[]), sem duplicados.

const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

const clampGroup = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num > 25) return null;
  return String(num);
};

// Regra do grupo (bicho) pelos 2 ultimos digitos
const calcGroupFromLast2 = (last2) => {
  const n = Number(last2);
  if (!Number.isFinite(n)) return null;
  // 00 => grupo 25
  if (n === 0) return '25';
  return String(Math.ceil(n / 4));
};

export const deriveValendoPalpites = (milharesBase, modalidadeDestino) => {
  const mod = String(modalidadeDestino || '').toUpperCase().trim();
  const base = uniq(milharesBase).map(onlyDigits).filter((s) => s.length >= 1);

  if (!base.length) return [];

  const out = [];

  for (const raw of base) {
    const d = raw.padStart(4, '0');
    const first3 = d.slice(0, 3);
    const last3 = d.slice(-3);
    const first2 = d.slice(0, 2);
    const mid2 = d.slice(1, 3);
    const last2 = d.slice(-2);
    const last1 = d.slice(-1);

    switch (mod) {
      case 'MILHAR':
      case 'MILHAR INV':
      case 'MILHAR E CT':
        out.push(d.slice(-4));
        break;

      case 'CENTENA':
      case 'CENTENA INV':
        out.push(last3);
        break;

      case 'CENTENA ESQUERDA':
      case 'CENTENA INV ESQ':
        out.push(first3);
        break;

      case 'DEZENA':
        out.push(last2);
        break;

      case 'DEZENA ESQ':
        out.push(first2);
        break;

      case 'DEZENA MEIO':
        out.push(mid2);
        break;

      case 'UNIDADE':
        out.push(last1);
        break;

      case 'GRUPO': {
        const g = calcGroupFromLast2(last2);
        if (g) out.push(g);
        break;
      }

      default:
        // Modalidade fora do MVP do VALENDO => nao deriva
        break;
    }
  }

  const unique = uniq(out).filter((p) => {
    const digits = onlyDigits(p);
    if (mod.startsWith('MILHAR')) return digits.length === 4;
    if (mod.startsWith('CENTENA')) return digits.length === 3;
    if (mod.startsWith('DEZENA')) return digits.length === 2;
    if (mod === 'UNIDADE') return digits.length === 1;
    if (mod === 'GRUPO') return Boolean(clampGroup(digits));
    return false;
  });

  return unique;
};
