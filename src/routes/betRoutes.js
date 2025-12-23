const express = require('express');
const betController = require('../controllers/betController');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * FEDERAL rule (backend validation)
 *
 * Business rule:
 * - FEDERAL only exists on Wednesday and Saturday at 20:00 (São Paulo time).
 * - On those same days, the "LT PT RIO 18HS" and "LT MALUQ RIO 18HS" slots must be unavailable.
 *
 * Notes:
 * - This middleware is defensive: it tries to extract hour/min from codigoHorario in multiple formats.
 * - If we cannot extract a time, we do not block (to avoid false negatives) — but we still block
 *   FEDERAL outside Wed/Sat by keyword.
 */
const normalize = (s) =>
  String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractHourMinute = (codigoHorario) => {
  const raw = normalize(codigoHorario);

  // 18:00, 18h00, 18H00, 18.00
  let m = raw.match(/\b(\d{1,2})\s*[:H\.]\s*(\d{2})\b/);
  if (m) return { hour: Number(m[1]), minute: Number(m[2]) };

  // 18HS, 18H
  m = raw.match(/\b(\d{1,2})\s*H(?:S)?\b/);
  if (m) return { hour: Number(m[1]), minute: 0 };

  // "18" isolated (last resort)
  m = raw.match(/\b(\d{1,2})\b/);
  if (m) return { hour: Number(m[1]), minute: 0 };

  return null;
};

const parseLocalDate = (yyyyMmDd) => {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return null;
  const parts = yyyyMmDd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isFederalDay = (yyyyMmDd) => {
  const d = parseLocalDate(yyyyMmDd);
  if (!d) return false;
  const dow = d.getDay();
  return dow === 3 || dow === 6; // Wed or Sat
};

const validateFederalRules = (req, res, next) => {
  try {
    const { codigoHorario, apostas, loteria: loteriaGlobal } = req.body || {};
    const payload = Array.isArray(apostas) && apostas.length ? apostas : [req.body || {}];

    for (const ap of payload) {
      const dateStr = ap?.data;
      const loteria = ap?.loteria || loteriaGlobal || '';
      const cod = ap?.codigoHorario || codigoHorario;
      const code = normalize(cod);
      const loteriaNorm = normalize(loteria);

      const hasFederalKeyword = code.includes('FEDERAL') || loteriaNorm.includes('FEDERAL');
      const time = extractHourMinute(cod);
      const hour = time?.hour;

      if (!dateStr) continue;

      const federalDay = isFederalDay(dateStr);

      const isPtRio = /\bPT\s*RIO\b/.test(loteriaNorm);
      const isMaluqRio = /\bMALUQ\s*RIO\b/.test(loteriaNorm);
      const is18 = hour === 18;
      const isBlocked18Slot = (isPtRio || isMaluqRio) && is18 && !hasFederalKeyword;

      const is20 = hour === 20;

      if (federalDay) {
        if (isBlocked18Slot) {
          return res.status(400).json({
            error:
              'Neste dia há FEDERAL às 20h. As opções LT PT RIO 18HS e LT MALUQ RIO 18HS ficam indisponíveis.',
          });
        }
        if (hasFederalKeyword) {
          if (hour == null) {
            return res.status(400).json({ error: 'Horário inválido para FEDERAL. Selecione FEDERAL 20h.' });
          }
          if (!is20) {
            return res.status(400).json({ error: 'FEDERAL só é permitido às 20h (quarta e sábado).' });
          }
        }
      } else if (hasFederalKeyword) {
        return res.status(400).json({ error: 'FEDERAL só está disponível nas quartas e sábados às 20h.' });
      }
    }

    return next();
  } catch (e) {
    return res.status(500).json({ error: 'Falha na validação de apostas.' });
  }
};

// Create bet with backend validation
router.post('/', authMiddleware, validateFederalRules, betController.create);

router.get('/my-bets', authMiddleware, betController.myBets);
router.get('/result-pules', authMiddleware, reportController.listResultPules);
router.get('/', authMiddleware, betController.list);

module.exports = router;
