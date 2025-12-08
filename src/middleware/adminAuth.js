module.exports = (req, res, next) => {
  const token = req.headers['x-admin-token'] || req.headers['x-admin-key'];
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_TOKEN não configurado no servidor.' });
  }

  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Acesso admin negado.' });
  }

  return next();
};
