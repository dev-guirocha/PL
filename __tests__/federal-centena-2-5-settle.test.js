const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const FIXED_DATE = '2098-02-11';
const ORIGIN = 'http://localhost:5173';

describe('Settle - Centena 2/5', () => {
  let admin;
  let adminToken;
  let user;
  let result;
  let bet;

  beforeAll(async () => {
    admin = await prisma.user.create({
      data: {
        name: 'Admin 2/5',
        phone: randomPhone(),
        password: 'hash',
        isAdmin: true,
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    adminToken = signToken(admin);

    user = await prisma.user.create({
      data: {
        name: 'Player 2/5',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });

    result = await prisma.result.create({
      data: {
        loteria: 'FEDERAL',
        codigoHorario: 'FEDERAL 20H',
        dataJogo: FIXED_DATE,
        numeros: JSON.stringify(['7337', '1527', '6222', '9440', '4328']),
      },
    });

    const aposta = {
      jogo: 'Tradicional',
      data: FIXED_DATE,
      modalidade: 'CENTENA',
      colocacao: '2/5 PREMIO',
      palpites: ['440'],
      modoValor: 'cada',
      valorAposta: 2,
      valorPorNumero: 2,
      total: 2,
    };

    bet = await prisma.bet.create({
      data: {
        userId: user.id,
        loteria: 'FEDERAL',
        codigoHorario: 'FEDERAL 20H',
        dataJogo: FIXED_DATE,
        modalidade: 'CENTENA',
        colocacao: '2/5 PREMIO',
        total: new Prisma.Decimal('2.00'),
        prize: new Prisma.Decimal('0.00'),
        status: 'open',
        palpites: JSON.stringify([aposta]),
      },
    });
  });

  afterAll(async () => {
    if (user?.id) await prisma.transaction.deleteMany({ where: { userId: user.id } });
    if (bet?.id) await prisma.bet.delete({ where: { id: bet.id } });
    if (result?.id) await prisma.result.delete({ where: { id: result.id } });
    if (user?.id) await prisma.user.delete({ where: { id: user.id } });
    if (admin?.id) await prisma.user.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  });

  test('credits prize when hit is in 2nd-5th range', async () => {
    const settle = await request(app)
      .post(`/api/admin/results/${result.id}/settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN);

    expect(settle.status).toBe(200);

    const updatedBet = await prisma.bet.findUnique({ where: { id: bet.id } });
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const tx = await prisma.transaction.findFirst({
      where: { userId: user.id, type: 'prize', description: `Prêmio (${bet.id})` },
    });

    expect(updatedBet.status).toBe('won');
    expect(updatedBet.prize.toFixed(2)).toBe('400.00');
    expect(updatedBet.prizeCreditedAt).not.toBeNull();
    expect(updatedUser.balance.toFixed(2)).toBe('400.00');
    expect(tx).not.toBeNull();
    expect(tx.amount.toFixed(2)).toBe('400.00');
  });
});
