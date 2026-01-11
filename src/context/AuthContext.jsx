import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { setBearerEnabled, setBearerToken } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authToken, setAuthTokenState] = useState(null);

  const setAuthToken = useCallback((token) => {
    const normalized = token || null;
    setAuthTokenState(normalized);
    setBearerToken(normalized);
  }, []);

  const setBearerFallback = useCallback((enabled) => {
    setBearerEnabled(Boolean(enabled));
  }, []);

  const refreshUser = useCallback(async () => {
    const loggedIn = typeof window !== 'undefined' ? localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn') : null;
    if (!loggedIn) {
      setUser(null);
      setBalance(0);
      setBonus(0);
      setLoadingUser(false);
      return;
    }
    setAuthError('');
    setLoadingUser(true);
    try {
      const res = await api.get('/wallet/me');
      const payload = res.data || {};
      setUser(payload || null);
      setBalance(Number(payload.balance ?? 0));
      setBonus(Number(payload.bonus ?? 0));
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 && authToken) {
        try {
          setBearerFallback(true);
          const retry = await api.get('/wallet/me');
          const payload = retry.data || {};
          setUser(payload || null);
          setBalance(Number(payload.balance ?? 0));
          setBonus(Number(payload.bonus ?? 0));
          setLoadingUser(false);
          return;
        } catch (retryErr) {
          setBearerFallback(false);
        }
      }
      setAuthError(err.response?.data?.error || 'Erro ao buscar usuário.');
      setUser(null);
      setBalance(0);
      setBonus(0);
    } finally {
      setLoadingUser(false);
    }
  }, [authToken, setBearerFallback]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const updateBalances = ({ balance: newBalance, bonus: newBonus }) => {
    if (newBalance !== undefined) setBalance(Number(newBalance));
    if (newBonus !== undefined) setBonus(Number(newBonus));
  };

  const setAuthUser = (data) => {
    setUser(data || null);
    if (data?.balance !== undefined) setBalance(Number(data.balance));
    if (data?.bonus !== undefined) setBonus(Number(data.bonus));
  };

  const logout = () => {
    setAuthToken(null);
    setBearerFallback(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('loggedIn');
      sessionStorage.removeItem('loggedIn');
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
    }
    setUser(null);
    setBalance(0);
    setBonus(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        balance,
        bonus,
        loadingUser,
        authError,
        refreshUser,
        updateBalances,
        setAuthUser,
        logout,
        authToken,
        setAuthToken,
        setBearerFallback,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
