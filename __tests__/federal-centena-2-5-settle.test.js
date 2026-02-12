const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const FIXED_DATE = '2098-02-11';
const ORIGIN = 'http://localhost:5173';

const CASES = [
  { colocacao: '1/5 PREMIO', expectedStatus: 'won', expectedPrize: '320.00' },
  { colocacao: '2/5 PREMIO', expectedStatus: 'won', expectedPrize: '400.00' },
  { colocacao: '3/5 PREMIO', expectedStatus: 'won', expectedPrize: '533.33' },
  { colocacao: '4/5 PREMIO', expectedStatus: 'won', expectedPrize: '800.00' },
  { colocacao: '2/4 PREMIO', expectedStatus: 'won', expectedPrize: '533.33' },
  { colocacao: '3/4 PREMIO', expectedStatus: 'won', expectedPrize: '800.00' },
  { colocacao: '1/3 PREMIO', expectedStatus: 'lost', expectedPrize: '0.00' },
];

describe('Settle - Centena ranges (2/5, 3/5, 4/5, etc)', () => {
  let admin;
  let adminToken;
  let user;
  let result;
  let createdBets = [];

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

    for (const testCase of CASES) {
      const aposta = {
        jogo: 'Tradicional',
        data: FIXED_DATE,
        modalidade: 'CENTENA',
        colocacao: testCase.colocacao,
        palpites: ['440'],
        modoValor: 'cada',
        valorAposta: 2,
        valorPorNumero: 2,
        total: 2,
      };

      const bet = await prisma.bet.create({
        data: {
          userId: user.id,
          loteria: 'FEDERAL',
          codigoHorario: 'FEDERAL 20H',
          dataJogo: FIXED_DATE,
          modalidade: 'CENTENA',
          colocacao: testCase.colocacao,
          total: new Prisma.Decimal('2.00'),
          prize: new Prisma.Decimal('0.00'),
          status: 'open',
          palpites: JSON.stringify([aposta]),
        },
      });

      createdBets.push({ ...testCase, id: bet.id });
    }
  });

  afterAll(async () => {
    if (user?.id) await prisma.transaction.deleteMany({ where: { userId: user.id } });
    if (createdBets.length) {
      await prisma.bet.deleteMany({ where: { id: { in: createdBets.map((b) => b.id) } } });
    }
    if (result?.id) await prisma.result.delete({ where: { id: result.id } });
    if (user?.id) await prisma.user.delete({ where: { id: user.id } });
    if (admin?.id) await prisma.user.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  });

  test('credits all supported ranges correctly (including 3/5 and 4/5)', async () => {
    const settle = await request(app)
      .post(`/api/admin/results/${result.id}/settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN);

    expect(settle.status).toBe(200);

    const updatedBets = await prisma.bet.findMany({
      where: { id: { in: createdBets.map((b) => b.id) } },
      select: { id: true, status: true, prize: true, prizeCreditedAt: true },
    });
    const byId = new Map(updatedBets.map((b) => [b.id, b]));

    for (const testCase of createdBets) {
      const updated = byId.get(testCase.id);
      expect(updated.status).toBe(testCase.expectedStatus);
      expect(updated.prize.toFixed(2)).toBe(testCase.expectedPrize);

      if (testCase.expectedStatus === 'won') {
        expect(updated.prizeCreditedAt).not.toBeNull();
        const tx = await prisma.transaction.findFirst({
          where: { userId: user.id, type: 'prize', description: `Prêmio (${testCase.id})` },
        });
        expect(tx).not.toBeNull();
        expect(tx.amount.toFixed(2)).toBe(testCase.expectedPrize);
      } else {
        expect(updated.prizeCreditedAt).toBeNull();
      }
    }
  });
});
