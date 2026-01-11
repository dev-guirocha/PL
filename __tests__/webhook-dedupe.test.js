const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { app, prisma, request, randomPhone } = require('./helpers/testUtils');

process.env.WOOVI_WEBHOOK_SECRET = process.env.WOOVI_WEBHOOK_SECRET || 'test-webhook-secret';

const signPayload = (payload) =>
  crypto.createHmac('sha256', process.env.WOOVI_WEBHOOK_SECRET).update(payload).digest('hex');

describe('Webhook event dedupe', () => {
  let user;
  let pixCharge;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'Webhook User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });

    pixCharge = await prisma.pixCharge.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal('10.00'),
        status: 'PENDING',
        credited: false,
        correlationId: `pix-${Date.now()}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { correlationId: pixCharge?.correlationId } });
    if (user?.id) {
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
    }
    if (pixCharge?.id) await prisma.pixCharge.delete({ where: { id: pixCharge.id } });
    if (user?.id) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('replay event does not credit twice', async () => {
    const payload = {
      charge: {
        status: 'PAID',
        correlationID: pixCharge.correlationId,
        value: 1000,
        paymentMethods: { pix: { txId: 'TX123' } },
      },
    };

    const raw = JSON.stringify(payload);
    const signature = signPayload(raw);

    const res1 = await request(app)
      .post('/api/webhook/openpix')
      .set('x-openpix-signature', signature)
      .set('x-openpix-event-id', `event-${pixCharge.correlationId}`)
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/webhook/openpix')
      .set('x-openpix-signature', signature)
      .set('x-openpix-event-id', `event-${pixCharge.correlationId}`)
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res2.status).toBe(200);

    const refreshed = await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } });
    expect(refreshed.balance.toFixed(2)).toBe('10.00');
  });

  test('webhook event links pixChargeId when correlationId exists', async () => {
    const payload = {
      charge: {
        status: 'PAID',
        correlationID: pixCharge.correlationId,
        value: 1000,
        paymentMethods: { pix: { txId: 'TX999' } },
      },
    };

    const raw = JSON.stringify(payload);
    const signature = signPayload(raw);
    const eventId = `event-map-${pixCharge.correlationId}-${Date.now()}`;

    const res = await request(app)
      .post('/api/webhook/openpix')
      .set('x-openpix-signature', signature)
      .set('x-openpix-event-id', eventId)
      .set('x-webhook-provider', 'openpix')
      .set('Content-Type', 'application/json')
      .send(raw);

    expect(res.status).toBe(200);

    const event = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'openpix', eventId } },
      select: { pixChargeId: true },
    });

    expect(event?.pixChargeId).toBe(pixCharge.id);
  });
});
