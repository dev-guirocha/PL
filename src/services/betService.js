const { z } = require('zod');
const { recordTransaction } = require('./financeService');
const {
  ZERO,
  DECIMAL_REGEX,
  normalizeDecimalString,
  toMoney,
  formatMoney,
  splitDebit,
  calculateCommission,
} = require('../utils/money');
const { isWithinCutoff, todayInTimezone } = require('../utils/time');

const ERR_NO_BALANCE = 'ERR_NO_BALANCE';
const ERR_NO_USER = 'ERR_NO_USER';
const ERR_CUTOFF_PASSED = 'ERR_CUTOFF_PASSED';
const SUPERVISOR_COMMISSION_PCT = normalizeDecimalString(process.env.SUPERVISOR_COMMISSION_PCT || '0');
const SUPERVISOR_COMMISSION_BASIS = process.env.SUPERVISOR_COMMISSION_BASIS || 'stake';

const amountSchema = z.preprocess(
  (val) => normalizeDecimalString(val),
  z
    .string({
      required_error: 'Valor é obrigatório.',
      invalid_type_error: 'Valor inválido.',
    })
    .refine((val) => val && DECIMAL_REGEX.test(val), 'Valor inválido.')
    .transform((val) => toMoney(val))
    .refine((val) => val.greaterThan(ZERO), 'O valor deve ser maior que zero.'),
);

const apostaSchema = z
  .object({
    valorAposta: amountSchema.optional(),
    palpites: z.array(z.union([z.string(), z.number()])).max(500, 'Limite de palpites excedido.').default([]),
    modoValor: z.enum(['cada', 'todos']).optional(),
    jogo: z.string().optional(),
    data: z.string().optional(),
    modalidade: z.string().optional(),
    colocacao: z.string().optional(),
    valorPorNumero: amountSchema.optional(),
    total: amountSchema.optional(),
  })
  .passthrough();

const betRequestSchema = z.object({
  apostas: z.array(apostaSchema).min(1, 'Envie ao menos uma aposta para debitar.').max(200, 'Limite de apostas excedido.'),
  loteria: z.string({ required_error: 'Informe o nome da loteria.' }).min(1, 'Nome da loteria inválido.'),
  codigoHorario: z.string({ required_error: 'Informe o horário.' }).min(1, 'Horário inválido.'),
});

function calculateBetTotal(aposta) {
  const valor = toMoney(aposta?.valorAposta ?? aposta?.valorPorNumero ?? aposta?.total);
  if (!valor.greaterThan(ZERO)) throw new Error('Valor da aposta inválido.');
  const palpites = Array.isArray(aposta?.palpites) ? aposta.palpites : [];
  const qtd = palpites.length;
  const modo = aposta?.modoValor === 'cada' ? 'cada' : 'total';
  const total = modo === 'cada' ? valor.mul(Math.max(qtd, 1)) : valor;
  if (!total.greaterThan(ZERO)) throw new Error('Total calculado inválido.');
  return total;
}

async function placeBet({ prismaClient, userId, apostas, loteria, codigoHorario }) {
  let debited = ZERO;
  try {
    debited = apostas.reduce((acc, ap) => acc.add(calculateBetTotal(ap)), ZERO).toDecimalPlaces(2);
  } catch (err) {
    const invalid = new Error(err.message || 'Dados de aposta inválidos.');
    invalid.code = 'ERR_INVALID_BET';
    throw invalid;
  }

  const firstData = apostas?.[0]?.data || null;
  const dataJogo = firstData || todayInTimezone();
  const isAllowed = isWithinCutoff({ dataJogo, codigoHorario });
  if (!isAllowed) {
    const err = new Error('Horário encerrado para este sorteio.');
    err.code = ERR_CUTOFF_PASSED;
    throw err;
  }

  const result = await prismaClient.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, balance: true, bonus: true, supervisorId: true },
    });

    if (!user) {
      const err = new Error(ERR_NO_USER);
      err.code = ERR_NO_USER;
      throw err;
    }

    const debit = splitDebit({
      balance: user.balance,
      bonus: user.bonus,
      total: debited,
    });

    if (!debit.ok) {
      const err = new Error(ERR_NO_BALANCE);
      err.code = ERR_NO_BALANCE;
      throw err;
    }

    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        balance: { gte: debit.debitFromBalance },
        bonus: { gte: debit.debitFromBonus },
      },
      data: {
        balance: debit.debitFromBalance.greaterThan(ZERO) ? { decrement: debit.debitFromBalance } : undefined,
        bonus: debit.debitFromBonus.greaterThan(ZERO) ? { decrement: debit.debitFromBonus } : undefined,
      },
    });

    if (updated.count === 0) {
      const err = new Error(ERR_NO_BALANCE);
      err.code = ERR_NO_BALANCE;
      throw err;
    }

    await recordTransaction({
      userId,
      type: 'bet',
      amount: debited.negated(),
      description: `Aposta em ${loteria}`,
      client: tx,
      suppressErrors: false,
    });

    const bet = await tx.bet.create({
      data: {
        userId,
        loteria,
        codigoHorario,
        total: debited,
        dataJogo: firstData,
        modalidade: apostas?.length === 1 ? apostas?.[0]?.modalidade || null : 'MULTIPLAS',
        colocacao: apostas?.length === 1 ? apostas?.[0]?.colocacao || null : null,
        palpites: JSON.stringify(apostas),
      },
      select: { id: true, total: true, createdAt: true, loteria: true, codigoHorario: true, userId: true },
    });

    let supervisorCommission = null;
    if (user?.supervisorId) {
      const commissionAmount = calculateCommission(debited, SUPERVISOR_COMMISSION_PCT);
      if (commissionAmount.greaterThan(ZERO)) {
        await tx.supervisorCommission.create({
          data: {
            supervisorId: user.supervisorId,
            userId,
            betId: bet.id,
            amount: commissionAmount,
            basis: SUPERVISOR_COMMISSION_BASIS,
            status: 'pending',
          },
        });
        supervisorCommission = commissionAmount;
      }
    }

    return { user, bet, supervisorCommission };
  });

  const betRef = `${userId}-${result.bet.id}`;

  const userOut = result.user
    ? {
        ...result.user,
        balance: formatMoney(result.user.balance),
        bonus: formatMoney(result.user.bonus),
      }
    : null;
  const supervisorCommissionOut =
    result.supervisorCommission !== null ? formatMoney(result.supervisorCommission) : null;

  return {
    ...result,
    user: userOut,
    debited: formatMoney(debited),
    bet: { ...result.bet, betRef, total: formatMoney(result.bet.total) },
    supervisorCommission: supervisorCommissionOut,
  };
}

module.exports = {
  betRequestSchema,
  placeBet,
  ERR_NO_BALANCE,
  ERR_NO_USER,
  ERR_CUTOFF_PASSED,
};
