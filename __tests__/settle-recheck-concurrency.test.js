const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const FIXED_DATE = '2099-02-15';

describe('POST /api/admin/results/:id/settle + /api/admin/bets/:id/recheck concurrency', () => {
  let admin;
  let adminToken;
  let user;
  let bet;
  let result;

  beforeAll(async () => {
    admin = await prisma.user.create({
      data: {
        name: 'Admin User',
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
        name: 'Player User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });

    result = await prisma.result.create({
      data: {
        loteria: 'TESTE',
        codigoHorario: '10:00',
        dataJogo: FIXED_DATE,
        numeros: JSON.stringify(['0012']),
      },
    });

    const aposta = {
      modalidade: 'DEZENA',
      colocacao: '1 PREMIO',
      palpites: ['12'],
      total: 10,
    };

    bet = await prisma.bet.create({
      data: {
        userId: user.id,
        loteria: 'TESTE',
        codigoHorario: '10:00',
        dataJogo: FIXED_DATE,
        modalidade: 'DEZENA',
        colocacao: '1 PREMIO',
        total: new Prisma.Decimal('10.00'),
        prize: new Prisma.Decimal('0.00'),
        status: 'open',
        palpites: JSON.stringify([aposta]),
        resultId: null,
      },
    });
  });

  afterAll(async () => {
    if (bet?.id) await prisma.bet.delete({ where: { id: bet.id } });
    if (result?.id) await prisma.result.delete({ where: { id: result.id } });
    if (user?.id) {
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    if (admin?.id) {
      await prisma.user.delete({ where: { id: admin.id } });
    }
    await prisma.$disconnect();
  });

  test('credits balance only once', async () => {
    const settleUrl = `/api/admin/results/${result.id}/settle`;
    const recheckUrl = `/api/admin/bets/${bet.id}/recheck`;

    const [settleRes, recheckRes] = await Promise.all([
      request(app)
        .post(settleUrl)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:5173'),
      request(app)
        .post(recheckUrl)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:5173'),
    ]);

    expect([settleRes.status, recheckRes.status]).toEqual(
      expect.arrayContaining([200]),
    );

    const refreshed = await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } });
    expect(refreshed.balance.toFixed(2)).toBe('800.00');

    const betRefreshed = await prisma.bet.findUnique({ where: { id: bet.id }, select: { prizeCreditedAt: true } });
    expect(betRefreshed.prizeCreditedAt).not.toBeNull();
  });
});
