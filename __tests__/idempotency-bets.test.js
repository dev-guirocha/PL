const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const futureDate = () => {
  const dt = new Date('2099-12-31T00:00:00Z');
  return dt.toISOString().slice(0, 10);
};

const buildPayload = ({ valorAposta = 10, palpites = ['12', '34'] } = {}) => ({
  loteria: 'TESTE',
  codigoHorario: '23:59',
  dataJogo: futureDate(),
  apostas: [
    {
      data: futureDate(),
      modalidade: 'DEZENA',
      colocacao: '1 PREMIO',
      palpites,
      modoValor: 'cada',
      valorAposta,
    },
  ],
});

describe('POST /api/bets idempotency', () => {
  let user;
  let token;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'Idem User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('100.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    token = signToken(user);
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

  test('same Idempotency-Key returns same betId and debits once', async () => {
    const payload = buildPayload();

    const key = `idem-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.bet.id).toBe(res1.body.bet.id);

    const refreshed = await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } });
    expect(refreshed.balance.toFixed(2)).toBe('80.00');
  });

  test('same Idempotency-Key with different payload returns 409', async () => {
    const payload = buildPayload({ valorAposta: 5, palpites: ['10', '20'] });

    const key = `idem-diff-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send({
        ...payload,
        apostas: [
          {
            ...payload.apostas[0],
            valorAposta: 6,
          },
        ],
      });

    expect(res2.status).toBe(409);
  });

  test('concurrent different Idempotency-Keys never return 500 and debit only created bets', async () => {
    const concurrentUser = await prisma.user.create({
      data: {
        name: 'Concurrent User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('20.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    const concurrentToken = signToken(concurrentUser);
    const payload = buildPayload({ valorAposta: 1, palpites: ['12'] });
    const keyPrefix = `concurrent-${Date.now()}`;

    try {
      const responses = await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          request(app)
            .post('/api/bets')
            .set('Authorization', `Bearer ${concurrentToken}`)
            .set('Idempotency-Key', `${keyPrefix}-${index}`)
            .set('Origin', 'http://localhost:5173')
            .send(payload),
        ),
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses).not.toContain(500);
      statuses.forEach((status) => {
        expect([201, 400, 402, 409]).toContain(status);
      });

      const successCount = statuses.filter((status) => status === 201).length;
      const [betsCount, refreshedUser] = await Promise.all([
        prisma.bet.count({ where: { userId: concurrentUser.id } }),
        prisma.user.findUnique({ where: { id: concurrentUser.id }, select: { balance: true } }),
      ]);

      expect(betsCount).toBe(successCount);
      expect(refreshedUser.balance.greaterThanOrEqualTo(new Prisma.Decimal('0.00'))).toBe(true);
      expect(refreshedUser.balance.toFixed(2)).toBe(new Prisma.Decimal('20.00').sub(successCount).toFixed(2));
    } finally {
      await prisma.idempotencyKey.deleteMany({ where: { userId: concurrentUser.id } });
      await prisma.bet.deleteMany({ where: { userId: concurrentUser.id } });
      await prisma.transaction.deleteMany({ where: { userId: concurrentUser.id } });
      await prisma.user.delete({ where: { id: concurrentUser.id } });
    }
  });
});
