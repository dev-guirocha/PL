/**
 * Proteção CSRF simples baseada em Origin/Referer.
 * Permite métodos de leitura e bloqueia POST/PUT/PATCH/DELETE vindos de origens não confiáveis.
 */
function createCsrfProtection(allowedOrigins = [], wildcardOrigins = []) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const trustedClients = (process.env.CSRF_TRUSTED_CLIENTS || 'mobile,trusted')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const allowEmptyOrigin = process.env.CSRF_ALLOW_EMPTY_ORIGIN === 'true';
  return (req, res, next) => {
    if (safeMethods.includes(req.method)) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const client = String(req.headers['x-client'] || '').trim().toLowerCase();
    const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');

    const isAllowedOrigin = (value) => {
      if (!value) return false;
      if (allowedOrigins.some((o) => value.startsWith(o))) return true;
      return wildcardOrigins.some((re) => re.test(value));
    };

    // Quando não há header, permitimos somente se for cliente confiável autenticado.
    const allowEmpty =
      allowEmptyOrigin || (hasBearer && trustedClients.includes(client));
    const isTrusted =
      !origin && !referer
        ? allowEmpty
        : (origin && isAllowedOrigin(origin)) || (referer && isAllowedOrigin(referer));

    if (!isTrusted) {
      return res.status(403).json({ error: 'Requisição bloqueada por política CSRF.' });
    }

    return next();
  };
}

module.exports = createCsrfProtection;
