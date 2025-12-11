/**
 * Proteção CSRF simples baseada em Origin/Referer.
 * Permite métodos de leitura e bloqueia POST/PUT/PATCH/DELETE vindos de origens não confiáveis.
 */
function createCsrfProtection(allowedOrigins = [], wildcardOrigins = []) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return (req, res, next) => {
    if (safeMethods.includes(req.method)) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    const isAllowedOrigin = (value) => {
      if (!value) return false;
      if (allowedOrigins.some((o) => value.startsWith(o))) return true;
      return wildcardOrigins.some((re) => re.test(value));
    };

    // Quando não há header (ex.: apps móveis ou curl), permitimos para não quebrar integrações confiáveis.
    const isTrusted =
      !origin && !referer
        ? true
        : (origin && isAllowedOrigin(origin)) || (referer && isAllowedOrigin(referer));

    if (!isTrusted) {
      return res.status(403).json({ error: 'Requisição bloqueada por política CSRF.' });
    }

    return next();
  };
}

module.exports = createCsrfProtection;
