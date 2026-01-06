/**
 * Proteção CSRF simples baseada em Origin/Referer.
 * Permite métodos de leitura e bloqueia POST/PUT/PATCH/DELETE vindos de origens não confiáveis.
 */
function createCsrfProtection(allowedOrigins = [], wildcardOrigins = [], excludedPaths = []) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const defaultExcluded = ['/api/auth/', '/api/webhook/'];

  return (req, res, next) => {
    if (safeMethods.includes(req.method)) return next();

    const pathToCheck = req.originalUrl || req.path;
    const isExcluded = [...defaultExcluded, ...excludedPaths].some((path) => pathToCheck.startsWith(path));
    if (isExcluded) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    const isAllowedOrigin = (value) => {
      if (!value) return false;
      if (allowedOrigins.some((o) => value.startsWith(o))) return true;
      return wildcardOrigins.some((re) => re.test(value));
    };

    const isTrusted =
      (origin && isAllowedOrigin(origin)) || (referer && isAllowedOrigin(referer));

    if (!isTrusted) {
      console.warn(`[CSRF] Bloqueado: Origin=${origin} Referer=${referer} Path=${pathToCheck}`);
      return res.status(403).json({ error: 'Requisição bloqueada por política CSRF.' });
    }

    return next();
  };
}

module.exports = createCsrfProtection;
