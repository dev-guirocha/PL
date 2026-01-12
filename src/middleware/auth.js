const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado.');
}
const AUTH_DEBUG = process.env.AUTH_DEBUG === 'true';
const MISSING_TOKEN_LOG_TTL_MS = 60 * 1000;
const missingTokenLogCache = new Map();

const getRequestIp = (req) =>
  req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || 'unknown';

const getCookieNames = (cookieHeader) => {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .map((cookie) => cookie.split('=')[0])
    .filter(Boolean);
};

const shouldLogMissingToken = (req) => {
  const ip = getRequestIp(req);
  const key = `${ip}|${req.path}`;
  const now = Date.now();
  const last = missingTokenLogCache.get(key);
  if (last && now - last < MISSING_TOKEN_LOG_TTL_MS) return false;
  missingTokenLogCache.set(key, now);
  if (missingTokenLogCache.size > 5000) {
    missingTokenLogCache.clear();
  }
  return true;
};

function getTokenFromCookie(req) {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) return null;
  return tokenCookie.substring('token='.length);
}

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader) {
    const [type, value] = authHeader.split(' ');
    if (type === 'Bearer' && value) token = value;
  }
  if (!token) token = getTokenFromCookie(req);
  if (!token) {
    if (AUTH_DEBUG && shouldLogMissingToken(req)) {
      const cookieHeader = req.headers?.cookie;
      console.info('[AUTH_DEBUG] missing_token', {
        method: req.method,
        originalUrl: req.originalUrl,
        path: req.path,
        host: req.headers?.host,
        xForwardedHost: req.headers['x-forwarded-host'],
        xForwardedProto: req.headers['x-forwarded-proto'],
        origin: req.headers?.origin,
        referer: req.headers?.referer,
        hasCookieHeader: Boolean(cookieHeader),
        cookieNames: getCookieNames(cookieHeader),
        hasAuthorizationHeader: Boolean(req.headers?.authorization),
        ua: req.headers['user-agent'],
      });
    }
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.isAdmin = Boolean(payload.isAdmin);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isBlocked: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      if (AUTH_DEBUG) console.warn('[AUTH_DEBUG] user_removed', { userId: req.userId });
      return res.status(403).json({ error: 'Usuário removido.' });
    }
    if (user.isBlocked) {
      if (AUTH_DEBUG) console.warn('[AUTH_DEBUG] user_blocked', { userId: req.userId });
      return res.status(403).json({ error: 'Usuário bloqueado.' });
    }

    return next();
  } catch (err) {
    if (AUTH_DEBUG) console.warn('[AUTH_DEBUG] invalid_token', { message: err.message });
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};
