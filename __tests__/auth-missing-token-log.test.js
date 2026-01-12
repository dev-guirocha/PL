const request = require('supertest');

describe('auth missing token logging', () => {
  const originalEnv = {
    AUTH_DEBUG: process.env.AUTH_DEBUG,
    VERCEL: process.env.VERCEL,
  };

  afterAll(() => {
    process.env.AUTH_DEBUG = originalEnv.AUTH_DEBUG;
    process.env.VERCEL = originalEnv.VERCEL;
  });

  test('returns 401 and does not log when AUTH_DEBUG=false', async () => {
    jest.resetModules();
    process.env.AUTH_DEBUG = 'false';
    process.env.VERCEL = '1';
    const app = require('../index');
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const res = await request(app).get('/api/wallet/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Não autenticado' });
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test('logs details once when AUTH_DEBUG=true', async () => {
    jest.resetModules();
    process.env.AUTH_DEBUG = 'true';
    process.env.VERCEL = '1';
    const app = require('../index');
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/wallet/me')
      .set('Host', 'api.pandaloterias.com')
      .set('Origin', 'https://www.pandaloterias.com')
      .set('User-Agent', 'jest-agent')
      .set('Cookie', 'foo=bar');

    expect(res.status).toBe(401);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message, payload] = logSpy.mock.calls[0];
    expect(message).toContain('[AUTH_DEBUG] missing_token');
    expect(payload).toMatchObject({
      method: 'GET',
      originalUrl: '/api/wallet/me',
      path: '/me',
      host: 'api.pandaloterias.com',
      origin: 'https://www.pandaloterias.com',
      hasCookieHeader: true,
      hasAuthorizationHeader: false,
      ua: 'jest-agent',
    });
    expect(payload.cookieNames).toEqual(['foo']);
    logSpy.mockRestore();
  });
});
