const prisma = require('../prisma');

module.exports = async (req, res, next) => {
  try {
    if (req.supervisor) return next();
    if (!req.userId) return res.status(401).json({ error: 'Nao autenticado.' });

    const authUser = req.user || await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isBlocked: true, deletedAt: true },
    });

    if (!authUser || authUser.isBlocked || authUser.deletedAt) {
      return res.status(403).json({ error: 'Usuario bloqueado.' });
    }

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: req.userId },
      select: { id: true, code: true, commissionRate: true, userId: true },
    });

    if (!supervisor) {
      return res.status(403).json({ error: 'Acesso restrito a supervisores.' });
    }

    req.supervisor = supervisor;
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao validar supervisor.' });
  }
};
