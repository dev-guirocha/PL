import { DateTime } from 'luxon';

const BRAZIL_TZ = 'America/Sao_Paulo';

export const getBrazilNow = () => DateTime.now().setZone(BRAZIL_TZ);

export const getBrazilTodayStr = () => getBrazilNow().toISODate();

export const getBrazilDatePlusDays = (baseIso, days) => {
  const base = baseIso
    ? DateTime.fromISO(String(baseIso), { zone: BRAZIL_TZ })
    : getBrazilNow();
  return base.plus({ days }).toISODate();
};

export const formatBrazilDateLabel = (isoDate) => {
  if (!isoDate) return '';
  const dt = DateTime.fromISO(String(isoDate), { zone: BRAZIL_TZ }).setLocale('pt-BR');
  return dt.toLocaleString({ weekday: 'short', day: '2-digit', month: '2-digit' });
};

export const getBrazilWeekday = (isoDate) => {
  if (!isoDate) return null;
  const dt = DateTime.fromISO(String(isoDate), { zone: BRAZIL_TZ });
  if (!dt.isValid) return null;
  return dt.weekday % 7; // Luxon: 1=Mon..7=Sun; JS: 0=Sun..6=Sat
};

export const getBrazilTimeParts = () => {
  const now = getBrazilNow();
  return { hour: now.hour, minute: now.minute };
};
