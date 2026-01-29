import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';

const DEFAULT_COUNTS = { withdrawals: 0, betsNew: 0, total: 0 };
const BETS_SEEN_KEY = 'adminBetsLastSeenAt';

const readBetsLastSeen = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(BETS_SEEN_KEY);
  if (raw) return raw;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();
  window.localStorage.setItem(BETS_SEEN_KEY, iso);
  return iso;
};

const writeBetsLastSeen = (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BETS_SEEN_KEY, value);
};

export const useNotifications = ({ intervalMs = 30000 } = {}) => {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const [betSince, setBetSince] = useState(() => readBetsLastSeen());
  const timerRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await api.get('/admin/notifications/count', {
        params: betSince ? { betSince } : {},
      });
      setCounts({ ...DEFAULT_COUNTS, ...(response.data || {}) });
    } catch (error) {
      // Silencia erro para nao poluir UI do admin com polling.
      console.error('Erro ao buscar notificacoes:', error);
    }
  }, [betSince]);

  useEffect(() => {
    fetchCounts();
    timerRef.current = setInterval(fetchCounts, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCounts, intervalMs]);

  const markBetsSeen = useCallback(() => {
    const now = new Date().toISOString();
    writeBetsLastSeen(now);
    setBetSince(now);
    setCounts((prev) => ({
      ...prev,
      betsNew: 0,
      total: Math.max(0, (prev.total || 0) - (prev.betsNew || 0)),
    }));
  }, []);

  return { counts, refresh: fetchCounts, markBetsSeen };
};
