// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado.');
}

const getTokenFromCookie = (req) => {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) return null;
  return tokenCookie.substring('token='.length);
};

const verifyToken = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    token = getTokenFromCookie(req);
  }
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = await prisma.user.findUnique({
      where: { id: decoded.id || decoded.userId },
      select: { id: true, name: true, isAdmin: true, isBlocked: true, deletedAt: true }
    });

    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }
    if (req.user.deletedAt) {
      return res.status(403).json({ error: 'Usuário removido.' });
    }
    if (req.user.isBlocked) {
      return res.status(403).json({ error: 'Usuário bloqueado.' });
    }

    return next();
  } catch (error) {
    console.error('Erro de Auth:', error.message);
    return res.status(401).json({ error: 'Token inválido.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito.' });
};

module.exports = { verifyToken, isAdmin };
