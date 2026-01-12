export const SESSION_ERROR_MESSAGE = 'cookie bloqueado ou API URL incorreta';

const selectStorage = ({ rememberMe, isLogin }) =>
  (rememberMe || !isLogin ? localStorage : sessionStorage);

const persistLoginState = ({ rememberMe, isLogin, user }) => {
  const storage = selectStorage({ rememberMe, isLogin });
  storage.setItem('loggedIn', 'true');
  storage.setItem('user', JSON.stringify(user));
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

export const completeLogin = async ({
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

  const ensureSession = async (attempts = 2) => {
    let lastErr;
    for (let i = 0; i < attempts; i += 1) {
      try {
        await apiClient.get('/wallet/me');
        return;
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    }
    throw lastErr;
  };

  try {
    await ensureSession();
  } catch (err) {
    if (fallbackToken && typeof setBearerFallback === 'function') {
      if (typeof setAuthToken === 'function') {
        setAuthToken(fallbackToken);
      }
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
