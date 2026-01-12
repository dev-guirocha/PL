export const getStoredLoggedIn = () => {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return null;
  return localStorage.getItem('loggedIn') || sessionStorage.getItem('loggedIn');
};

export const clearStoredSession = () => {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
  localStorage.removeItem('loggedIn');
  sessionStorage.removeItem('loggedIn');
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

export const getWalletMeSkipReason = ({ loggedIn, user, cooldownUntil }) => {
  if (!loggedIn && !user) return 'no-session';
  if (cooldownUntil && Date.now() < cooldownUntil) return 'cooldown';
  return null;
};
