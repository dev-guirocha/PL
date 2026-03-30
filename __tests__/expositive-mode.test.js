const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

process.env.WOOVI_WEBHOOK_SECRET = process.env.WOOVI_WEBHOOK_SECRET || 'test-webhook-secret';

const signPayload = (payload) =>
  crypto.createHmac('sha256', process.env.WOOVI_WEBHOOK_SECRET).update(payload).digest('hex');

describe('Expositive mode blocks transactional flows', () => {
  let user;
  let token;
  let previousMode;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'Expositive User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
        cpf: '12345678901',
      },
    });
    token = signToken(user);
  });

  beforeEach(() => {
    previousMode = process.env.EXPOSITIVE_PLATFORM_MODE;
    process.env.EXPOSITIVE_PLATFORM_MODE = 'true';
  });

  afterEach(async () => {
    if (previousMode === undefined) delete process.env.EXPOSITIVE_PLATFORM_MODE;
    else process.env.EXPOSITIVE_PLATFORM_MODE = previousMode;

    await prisma.webhookEvent.deleteMany({
      where: { correlationId: { startsWith: 'pix-expositive-' } },
    });
    await prisma.pixCharge.deleteMany({
      where: { correlationId: { startsWith: 'pix-expositive-' } },
    });
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
  });

  afterAll(async () => {
    if (user?.id) {
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  test('POST /api/pix/charge returns 503 and does not create a charge', async () => {
    const beforeCount = await prisma.pixCharge.count({ where: { userId: user.id } });

    const response = await request(app)
      .post('/api/pix/charge')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        amount: 20,
        cpf: '12345678901',
        nome: 'Expositive User',
        email: 'expo@example.com',
      });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: 'Plataforma em modo expositivo. A finalização de depósitos está temporariamente indisponível.',
    });

    const afterCount = await prisma.pixCharge.count({ where: { userId: user.id } });
    expect(afterCount).toBe(beforeCount);
  });

  test('webhook does not credit balance while expositive mode is active', async () => {
    const correlationId = `pix-expositive-${Date.now()}`;
    const pixCharge = await prisma.pixCharge.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal('10.00'),
        status: 'PENDING',
        credited: false,
        correlationId,
      },
    });

    const payload = {
      charge: {
        status: 'PAID',
        correlationID: correlationId,
        value: 1000,
        paymentMethods: { pix: { txId: 'TX-EXPO-1' } },
      },
    };

    const raw = JSON.stringify(payload);
    const signature = signPayload(raw);

    const response = await request(app)
      .post('/api/webhook/openpix')
      .set('x-openpix-signature', signature)
      .set('x-openpix-event-id', `event-${correlationId}`)
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(response.status).toBe(200);
    expect(response.text).toBe('OK (Deposits Disabled)');

    const [refreshedUser, refreshedCharge, transactions] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { balance: true, bonus: true } }),
      prisma.pixCharge.findUnique({ where: { id: pixCharge.id }, select: { status: true, credited: true } }),
      prisma.transaction.count({ where: { userId: user.id } }),
    ]);

    expect(refreshedUser.balance.toFixed(2)).toBe('0.00');
    expect(refreshedUser.bonus.toFixed(2)).toBe('0.00');
    expect(refreshedCharge).toEqual({ status: 'blocked', credited: false });
    expect(transactions).toBe(0);
  });
});
