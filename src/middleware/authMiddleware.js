// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');

      req.user = await prisma.user.findUnique({
        where: { id: decoded.id || decoded.userId },
        select: { id: true, name: true, isAdmin: true, isBlocked: true },
      });

      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não encontrado com este token.' });
      }

      if (req.user.isBlocked) {
        return res.status(403).json({ error: 'Sua conta está bloqueada.' });
      }

      return next();
    } catch (error) {
      console.error('Erro de Auth:', error.message);
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autorizado, sem token.' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito a administradores.' });
};

module.exports = { protect, admin };
