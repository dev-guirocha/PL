const { z } = require('zod');
const { recordTransaction } = require('./financeService');

const ERR_NO_BALANCE = 'ERR_NO_BALANCE';
const ERR_NO_USER = 'ERR_NO_USER';
const ERR_CUTOFF_PASSED = 'ERR_CUTOFF_PASSED';
const SUPERVISOR_COMMISSION_PCT = Number(process.env.SUPERVISOR_COMMISSION_PCT || 0);
const SUPERVISOR_COMMISSION_BASIS = process.env.SUPERVISOR_COMMISSION_BASIS || 'stake';

const amountSchema = z.preprocess(
  (val) => Number(val),
  z
    .number({
      required_error: 'Valor é obrigatório.',
      invalid_type_error: 'Valor inválido.',
    })
    .positive('O valor deve ser maior que zero.'),
);

const apostaSchema = z
  .object({
    valorAposta: amountSchema.optional(),
    palpites: z.array(z.union([z.string(), z.number()])).default([]),
    modoValor: z.enum(['cada', 'todos']).optional(),
    jogo: z.string().optional(),
    data: z.string().optional(),
    modalidade: z.string().optional(),
    colocacao: z.string().optional(),
    valorPorNumero: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();

const betRequestSchema = z.object({
  apostas: z.array(apostaSchema).min(1, 'Envie ao menos uma aposta para debitar.'),
  loteria: z.string({ required_error: 'Informe o nome da loteria.' }).min(1, 'Nome da loteria inválido.'),
  codigoHorario: z.string({ required_error: 'Informe o horário.' }).min(1, 'Horário inválido.'),
});

// Extrai a hora de um texto como "LT PT RIO 14HS" e monta um Date no dia informado
const resolveHorarioCutoff = ({ codigoHorario, data }) => {
  if (!codigoHorario) return null;
  const match = codigoHorario.match(/(\d{1,2})\s*hs/i);
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;

  // Usa a data da aposta (YYYY-MM-DD) ou hoje
  const baseDateStr = data || new Date().toISOString().slice(0, 10);
  const base = new Date(baseDateStr);
  if (Number.isNaN(base.getTime())) return null;
  base.setHours(hour, 0, 0, 0);
  return base;
};

function calculateBetTotal(aposta) {
  const valor = Number(aposta?.valorAposta ?? aposta?.valorPorNumero ?? aposta?.total);
  if (Number.isNaN(valor) || valor <= 0) {
    throw new Error('Valor da aposta inválido.');
  }
  const palpites = Array.isArray(aposta?.palpites) ? aposta.palpites : [];
  const qtd = palpites.length;
  const modo = aposta?.modoValor === 'cada' ? 'cada' : 'total';
  const total = modo === 'cada' ? valor * Math.max(qtd, 1) : valor;
  if (total <= 0) throw new Error('Total calculado inválido.');
  return total;
}

async function placeBet({ prismaClient, userId, apostas, loteria, codigoHorario }) {
  let debited = 0;
  try {
    debited = apostas.reduce((acc, ap) => acc + calculateBetTotal(ap), 0);
  } catch (err) {
    const invalid = new Error(err.message || 'Dados de aposta inválidos.');
    invalid.code = 'ERR_INVALID_BET';
    throw invalid;
  }

  const firstData = apostas?.[0]?.data || null;
  const cutoff = resolveHorarioCutoff({ codigoHorario, data: firstData });
  if (cutoff && new Date() >= cutoff) {
    const err = new Error('Horário encerrado para este sorteio.');
    err.code = ERR_CUTOFF_PASSED;
    throw err;
  }

  const result = await prismaClient.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, balance: { gte: debited } },
      data: { balance: { decrement: debited } },
    });

    if (updated.count === 0) {
      const userExists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) {
        const err = new Error(ERR_NO_USER);
        err.code = ERR_NO_USER;
        throw err;
      }
      const err = new Error(ERR_NO_BALANCE);
      err.code = ERR_NO_BALANCE;
      throw err;
    }

    await recordTransaction({
      userId,
      type: 'bet',
      amount: -debited,
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

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { balance: true, bonus: true, supervisorId: true },
    });

    let supervisorCommission = null;
    if (user?.supervisorId && SUPERVISOR_COMMISSION_PCT > 0) {
      const commissionAmount = Number(((debited * SUPERVISOR_COMMISSION_PCT) / 100).toFixed(2));
      if (commissionAmount > 0) {
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

  return { ...result, debited, bet: { ...result.bet, betRef } };
}

module.exports = {
  betRequestSchema,
  placeBet,
  ERR_NO_BALANCE,
  ERR_NO_USER,
  ERR_CUTOFF_PASSED,
};
