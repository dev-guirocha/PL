const { DateTime, Settings } = require('luxon');
const { isWithinCutoff } = require('../src/utils/time');

describe('cutoff inclusive', () => {
  const originalNow = Settings.now;

  afterEach(() => {
    Settings.now = originalNow;
  });

  test('aceita exatamente no cutoff', () => {
    const now = DateTime.fromISO('2025-01-15T11:00:00', { zone: 'America/Sao_Paulo' });
    Settings.now = () => now.toMillis();
    expect(isWithinCutoff({ dataJogo: '2025-01-15', codigoHorario: '11HS' })).toBe(true);
  });

  test('bloqueia apos o cutoff', () => {
    const now = DateTime.fromISO('2025-01-15T11:00:01', { zone: 'America/Sao_Paulo' });
    Settings.now = () => now.toMillis();
    expect(isWithinCutoff({ dataJogo: '2025-01-15', codigoHorario: '11HS' })).toBe(false);
  });
});
