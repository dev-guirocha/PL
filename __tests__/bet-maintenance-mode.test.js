const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const futureDate = () => {
  const dt = new Date('2099-12-31T00:00:00Z');
  return dt.toISOString().slice(0, 10);
};

describe('POST /api/bets maintenance mode', () => {
  let user;
  let token;
  let previousMode;
  let previousMessage;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'Maintenance User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('100.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    token = signToken(user);
  });

  beforeEach(() => {
    previousMode = process.env.BETTING_MAINTENANCE_MODE;
    previousMessage = process.env.BETTING_MAINTENANCE_MESSAGE;
  });

  afterEach(() => {
    if (previousMode === undefined) delete process.env.BETTING_MAINTENANCE_MODE;
    else process.env.BETTING_MAINTENANCE_MODE = previousMode;

    if (previousMessage === undefined) delete process.env.BETTING_MAINTENANCE_MESSAGE;
    else process.env.BETTING_MAINTENANCE_MESSAGE = previousMessage;
  });

  afterAll(async () => {
    if (user?.id) {
      await prisma.idempotencyKey.deleteMany({ where: { userId: user.id } });
      await prisma.bet.deleteMany({ where: { userId: user.id } });
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  test('returns 503 and does not create a bet while maintenance mode is active', async () => {
    process.env.BETTING_MAINTENANCE_MODE = 'true';
    process.env.BETTING_MAINTENANCE_MESSAGE = 'em manutencao';

    const payload = {
      loteria: 'TESTE',
      codigoHorario: '23:59',
      dataJogo: futureDate(),
      apostas: [
        {
          data: futureDate(),
          modalidade: 'DEZENA',
          colocacao: '1 PREMIO',
          palpites: ['12', '34'],
          modoValor: 'cada',
          valorAposta: 10,
        },
      ],
    };

    const response = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `maintenance-${Date.now()}`)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'em manutencao' });

    const [betsCount, refreshedUser] = await Promise.all([
      prisma.bet.count({ where: { userId: user.id } }),
      prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } }),
    ]);

    expect(betsCount).toBe(0);
    expect(refreshedUser.balance.toFixed(2)).toBe('100.00');
  });
});
