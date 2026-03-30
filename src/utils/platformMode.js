const DEFAULT_EXPOSITIVE_MODE = process.env.NODE_ENV !== 'test';
const DEFAULT_PLATFORM_MESSAGE = 'Plataforma em modo expositivo. A finalização de apostas e depósitos está temporariamente indisponível.';
const DEFAULT_BET_MESSAGE = 'Plataforma em modo expositivo. A finalização de apostas está temporariamente indisponível.';
const DEFAULT_DEPOSIT_MESSAGE = 'Plataforma em modo expositivo. A finalização de depósitos está temporariamente indisponível.';

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
};

const isExpositiveModeEnabled = () => {
  const envMode = parseBoolean(process.env.EXPOSITIVE_PLATFORM_MODE);
  return envMode === null ? DEFAULT_EXPOSITIVE_MODE : envMode;
};

const getPlatformMode = () => ({
  enabled: isExpositiveModeEnabled(),
  message: String(process.env.EXPOSITIVE_PLATFORM_MESSAGE || DEFAULT_PLATFORM_MESSAGE).trim() || DEFAULT_PLATFORM_MESSAGE,
});

const getBetPlacementAvailability = () => {
  if (!isExpositiveModeEnabled()) {
    return { enabled: true, message: '' };
  }

  const message =
    String(process.env.EXPOSITIVE_BET_MESSAGE || DEFAULT_BET_MESSAGE).trim() || DEFAULT_BET_MESSAGE;

  return {
    enabled: false,
    message,
    reason: 'expositive_mode',
  };
};

const getDepositAvailability = () => {
  if (!isExpositiveModeEnabled()) {
    return { enabled: true, message: '' };
  }

  const message =
    String(process.env.EXPOSITIVE_DEPOSIT_MESSAGE || DEFAULT_DEPOSIT_MESSAGE).trim() || DEFAULT_DEPOSIT_MESSAGE;

  return {
    enabled: false,
    message,
    reason: 'expositive_mode',
  };
};

module.exports = {
  getPlatformMode,
  getBetPlacementAvailability,
  getDepositAvailability,
  isExpositiveModeEnabled,
};
