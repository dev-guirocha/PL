const DEFAULT_MAINTENANCE_MODE = process.env.NODE_ENV !== 'test';
const DEFAULT_MAINTENANCE_MESSAGE = 'em manutencao';

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
};

const getBettingAvailability = () => {
  const envMode = parseBoolean(process.env.BETTING_MAINTENANCE_MODE);
  const maintenanceMode = envMode === null ? DEFAULT_MAINTENANCE_MODE : envMode;
  const message = String(process.env.BETTING_MAINTENANCE_MESSAGE || DEFAULT_MAINTENANCE_MESSAGE).trim() || DEFAULT_MAINTENANCE_MESSAGE;

  return {
    enabled: !maintenanceMode,
    message,
  };
};

module.exports = {
  getBettingAvailability,
};
