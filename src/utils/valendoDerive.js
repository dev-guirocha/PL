// utils/valendoDerive.js
// Engine pura de derivacao do VALENDO.
// Aceita base MILHAR (4) OU CENTENA (3).
// Nao permite "subir ordem": se a base for centena, nao deriva milhar.

const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// Grupo do bicho pelos 2 ultimos digitos
const calcGroupFromLast2 = (last2) => {
  const n = Number(last2);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return '25';
  return String(Math.ceil(n / 4));
};

const normalizeBase = (raw) => {
  const d = onlyDigits(raw);
  if (d.length === 4) return { kind: 'MILHAR', digits: d };
  if (d.length === 3) return { kind: 'CENTENA', digits: d };
  if (d.length > 4) return { kind: 'MILHAR', digits: d.slice(-4) };
  if (d.length > 3) return { kind: 'CENTENA', digits: d.slice(-3) };
  return null;
};

export const deriveValendoPalpites = (basePalpites, modalidadeDestino) => {
  const mod = String(modalidadeDestino || '').toUpperCase().trim();
  const bases = uniq(basePalpites)
    .map(normalizeBase)
    .filter(Boolean);

  if (!bases.length) return [];

  const out = [];

  for (const b of bases) {
    const isMilharBase = b.kind === 'MILHAR';
    const digits = b.digits;

    const w4 = isMilharBase ? digits.padStart(4, '0') : null;
    const w3 = !isMilharBase ? digits.padStart(3, '0') : null;

    if (isMilharBase) {
      const d4 = w4;
      const first3 = d4.slice(0, 3);
      const last3 = d4.slice(-3);
      const first2 = d4.slice(0, 2);
      const mid2 = d4.slice(1, 3);
      const last2 = d4.slice(-2);
      const last1 = d4.slice(-1);

      switch (mod) {
        case 'MILHAR':
        case 'MILHAR INV':
        case 'MILHAR E CT':
          out.push(d4);
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
          break;
      }

      continue;
    }

    const d3 = w3;
    const first2 = d3.slice(0, 2);
    const mid2 = d3.slice(1, 3);
    const last2 = d3.slice(-2);
    const last1 = d3.slice(-1);

    switch (mod) {
      case 'MILHAR':
      case 'MILHAR INV':
      case 'MILHAR E CT':
        break;
      case 'CENTENA':
      case 'CENTENA INV':
      case 'CENTENA ESQUERDA':
      case 'CENTENA INV ESQ':
        out.push(d3);
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
        break;
    }
  }

  const unique = uniq(out).filter((p) => {
    const d = onlyDigits(p);
    if (mod.startsWith('MILHAR')) return d.length === 4;
    if (mod.startsWith('CENTENA')) return d.length === 3;
    if (mod.startsWith('DEZENA')) return d.length === 2;
    if (mod === 'UNIDADE') return d.length === 1;
    if (mod === 'GRUPO') return Number(d) >= 1 && Number(d) <= 25;
    return false;
  });

  return unique;
};
