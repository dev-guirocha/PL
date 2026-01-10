const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta';
const AUTH_DEBUG = process.env.AUTH_DEBUG === 'true';

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
    if (AUTH_DEBUG) console.warn('[AUTH_DEBUG] missing_token', { path: req.path });
    return res.status(401).json({ error: 'Token não fornecido.' });
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
