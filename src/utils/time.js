const { DateTime } = require('luxon');

const TIMEZONE = 'America/Sao_Paulo';

const parseTimeFromCode = (codigoHorario) => {
  if (!codigoHorario) return null;
  const raw = String(codigoHorario);
  const hsMatch = raw.match(/(\d{1,2})\s*hs/i);
  if (hsMatch) {
    const hour = Number(hsMatch[1]);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
    return { hour, minute: 0 };
  }
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const buildCutoffTime = ({ dataJogo, codigoHorario, graceMinutes = 0 }) => {
  const base = DateTime.fromISO(String(dataJogo), { zone: TIMEZONE });
  if (!base.isValid) return null;
  const time = parseTimeFromCode(codigoHorario);
  if (!time) return null;
  const slot = base.set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 });
  if (!slot.isValid) return null;
  return slot.minus({ minutes: graceMinutes });
};

const isBeforeOrEqual = (now, cutoff) => now.toMillis() <= cutoff.toMillis();

const isWithinCutoff = ({ dataJogo, codigoHorario, graceMinutes = 0 }) => {
  const cutoff = buildCutoffTime({ dataJogo, codigoHorario, graceMinutes });
  if (!cutoff) return true;
  const now = DateTime.now().setZone(TIMEZONE);
  return isBeforeOrEqual(now, cutoff);
};

module.exports = {
  TIMEZONE,
  parseTimeFromCode,
  buildCutoffTime,
  isBeforeOrEqual,
  isWithinCutoff,
  todayInTimezone: () => DateTime.now().setZone(TIMEZONE).toISODate(),
};
