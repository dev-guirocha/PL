import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';

const DEFAULT_COUNTS = { withdrawals: 0, total: 0 };

export const useNotifications = ({ intervalMs = 30000 } = {}) => {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const timerRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await api.get('/admin/notifications/count');
      setCounts(response.data || DEFAULT_COUNTS);
    } catch (error) {
      // Silencia erro para nao poluir UI do admin com polling.
      console.error('Erro ao buscar notificacoes:', error);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    timerRef.current = setInterval(fetchCounts, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCounts, intervalMs]);

  return { counts, refresh: fetchCounts };
};
