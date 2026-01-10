const { toMoney, formatMoney, splitDebit, calculateCommission } = require('../src/utils/money');

describe('money calculations', () => {
  test('saldo + bonus sem drift (0.1 + 0.2 = 0.30)', () => {
    const balance = toMoney('0.1');
    const bonus = toMoney('0.2');
    const total = balance.add(bonus);
    expect(formatMoney(total)).toBe('0.30');
  });

  test('debito parcial usa bonus quando saldo nao cobre', () => {
    const result = splitDebit({ balance: '0.10', bonus: '0.25', total: '0.30' });
    expect(result.ok).toBe(true);
    expect(formatMoney(result.debitFromBalance)).toBe('0.10');
    expect(formatMoney(result.debitFromBonus)).toBe('0.20');
  });

  test('deposito/saque/comissao com centavos', () => {
    const deposit = toMoney('10.05');
    const withdrawal = toMoney('3.02');
    const remaining = deposit.sub(withdrawal);
    expect(formatMoney(remaining)).toBe('7.03');

    const commission = calculateCommission('12.34', '5');
    expect(formatMoney(commission)).toBe('0.62');
  });
});
