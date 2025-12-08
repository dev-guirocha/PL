const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta';

function getTokenFromCookie(req) {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) return null;
  return tokenCookie.substring('token='.length);
}

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader) {
    const [type, value] = authHeader.split(' ');
    if (type === 'Bearer' && value) token = value;
  }
  if (!token) token = getTokenFromCookie(req);
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};
