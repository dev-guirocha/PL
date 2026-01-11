const { Prisma } = require('@prisma/client');

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/;

const normalizeDecimalString = (value) => {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  if (!str) return '';

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && !hasDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  return str;
};

const toDecimalSafe = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  const normalized = normalizeDecimalString(value);
  if (!normalized || !DECIMAL_REGEX.test(normalized)) return ZERO;
  try {
    return new Prisma.Decimal(normalized);
  } catch {
    return ZERO;
  }
};

const requirePositiveDecimal = (value, message = 'Valor inválido.') => {
  const normalized = normalizeDecimalString(value);
  if (!normalized || !DECIMAL_REGEX.test(normalized)) {
    const err = new Error(message);
    err.code = 'ERR_INVALID_AMOUNT';
    throw err;
  }
  const decimal = new Prisma.Decimal(normalized);
  if (!decimal.greaterThan(ZERO)) {
    const err = new Error(message);
    err.code = 'ERR_INVALID_AMOUNT';
    throw err;
  }
  return decimal;
};

const toMoney = (value) => toDecimalSafe(value).toDecimalPlaces(2);
const formatMoney = (value) => toMoney(value).toFixed(2);

const splitDebit = ({ balance, bonus, total }) => {
  const availableBalance = toMoney(balance);
  const availableBonus = toMoney(bonus);
  const totalDebit = toMoney(total);
  const totalAvailable = availableBalance.add(availableBonus);

  if (totalAvailable.lessThan(totalDebit)) {
    return {
      ok: false,
      totalAvailable,
      debitFromBalance: availableBalance,
      debitFromBonus: availableBonus,
      totalDebit,
    };
  }

  const debitFromBalance = availableBalance.lessThan(totalDebit) ? availableBalance : totalDebit;
  const debitFromBonus = totalDebit.sub(debitFromBalance).toDecimalPlaces(2);

  return {
    ok: true,
    totalAvailable,
    debitFromBalance,
    debitFromBonus,
    totalDebit,
  };
};

const calculateCommission = (amount, percent) => {
  const base = toMoney(amount);
  const pct = toDecimalSafe(percent);
  if (!pct.greaterThan(ZERO)) return ZERO;
  return base.mul(pct).div(HUNDRED).toDecimalPlaces(2);
};

module.exports = {
  ZERO,
  HUNDRED,
  DECIMAL_REGEX,
  normalizeDecimalString,
  toDecimalSafe,
  requirePositiveDecimal,
  toMoney,
  formatMoney,
  splitDebit,
  calculateCommission,
};
