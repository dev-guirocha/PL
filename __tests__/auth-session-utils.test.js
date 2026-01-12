let clearStoredSession;
let getWalletMeSkipReason;

beforeAll(async () => {
  ({ clearStoredSession, getWalletMeSkipReason } = await import('../src/utils/authSession.mjs'));
});

const makeStorage = () => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('auth session utils', () => {
  beforeEach(() => {
    global.localStorage = makeStorage();
    global.sessionStorage = makeStorage();
  });

  test('clearStoredSession removes loggedIn and user', () => {
    localStorage.setItem('loggedIn', 'true');
    sessionStorage.setItem('user', JSON.stringify({ id: 1 }));

    clearStoredSession();

    expect(localStorage.getItem('loggedIn')).toBeNull();
    expect(sessionStorage.getItem('loggedIn')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
  });

  test('getWalletMeSkipReason blocks when no session or cooldown', () => {
    const noSession = getWalletMeSkipReason({ loggedIn: null, user: null, cooldownUntil: 0 });
    expect(noSession).toBe('no-session');

    const now = Date.now();
    const cooldown = getWalletMeSkipReason({ loggedIn: 'true', user: { id: 1 }, cooldownUntil: now + 30000 });
    expect(cooldown).toBe('cooldown');

    const ok = getWalletMeSkipReason({ loggedIn: 'true', user: { id: 1 }, cooldownUntil: 0 });
    expect(ok).toBeNull();
  });
});
