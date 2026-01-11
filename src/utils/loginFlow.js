const SESSION_ERROR_MESSAGE = 'cookie bloqueado ou API URL incorreta';

const selectStorage = ({ rememberMe, isLogin }) =>
  (rememberMe || !isLogin ? localStorage : sessionStorage);

const persistLoginState = ({ rememberMe, isLogin, user }) => {
  const storage = selectStorage({ rememberMe, isLogin });
  storage.setItem('loggedIn', 'true');
  storage.setItem('user', JSON.stringify(user));
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

const completeLogin = async ({
  apiClient,
  rememberMe,
  isLogin,
  user,
  fallbackToken,
  setAuthToken,
  setBearerFallback,
}) => {
  if (typeof setBearerFallback === 'function') {
    setBearerFallback(false);
  }
  if (typeof setAuthToken === 'function') {
    setAuthToken(fallbackToken || null);
  }

  const ensureSession = async () => {
    await apiClient.get('/wallet/me');
  };

  try {
    await ensureSession();
  } catch (err) {
    if (fallbackToken && typeof setBearerFallback === 'function') {
      setBearerFallback(true);
      try {
        await ensureSession();
      } catch (retryErr) {
        setBearerFallback(false);
        if (typeof setAuthToken === 'function') {
          setAuthToken(null);
        }
        throw new Error(SESSION_ERROR_MESSAGE);
      }
    } else {
      if (typeof setAuthToken === 'function') {
        setAuthToken(null);
      }
      throw new Error(SESSION_ERROR_MESSAGE);
    }
  }

  persistLoginState({ rememberMe, isLogin, user });
};

module.exports = {
  completeLogin,
  SESSION_ERROR_MESSAGE,
};
