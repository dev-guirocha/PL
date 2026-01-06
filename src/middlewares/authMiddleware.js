const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

const verifyToken = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chave-secreta');

    req.userId = decoded.userId || decoded.id;
    req.isAdmin = decoded.isAdmin;

    const isRefreshRoute = req.originalUrl.includes('/refresh') || req.path.includes('/refresh');

    if (!isRefreshRoute) {
      req.user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, name: true, isAdmin: true },
      });

      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }
    } else {
      req.user = { id: req.userId, isAdmin: req.isAdmin };
    }

    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.isAdmin || (req.user && req.user.isAdmin)) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito.' });
};

module.exports = { verifyToken, isAdmin };
