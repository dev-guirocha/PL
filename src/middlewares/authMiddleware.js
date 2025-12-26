// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

const verifyToken = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta_aqui');

      req.user = await prisma.user.findUnique({
        where: { id: decoded.id || decoded.userId },
        select: { id: true, name: true, isAdmin: true }
      });

      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }

      return next();
    } catch (error) {
      console.error('Erro de Auth:', error.message);
      return res.status(401).json({ error: 'Token inválido.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito.' });
};

module.exports = { verifyToken, isAdmin };
