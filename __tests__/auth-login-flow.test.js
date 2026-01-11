let completeLogin;
let SESSION_ERROR_MESSAGE;

beforeAll(async () => {
  ({ completeLogin, SESSION_ERROR_MESSAGE } = await import('../src/utils/loginFlow.mjs'));
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

describe('login flow cookie guard', () => {
  beforeEach(() => {
    global.localStorage = makeStorage();
    global.sessionStorage = makeStorage();
  });

  test('does not persist loggedIn when /wallet/me fails', async () => {
    const apiClient = { get: jest.fn().mockRejectedValue(new Error('no cookie')) };
    const setAuthToken = jest.fn();
    const setBearerFallback = jest.fn();

    await expect(
      completeLogin({
        apiClient,
        rememberMe: false,
        isLogin: true,
        user: { id: 1, name: 'User' },
        fallbackToken: null,
        setAuthToken,
        setBearerFallback,
      }),
    ).rejects.toThrow(SESSION_ERROR_MESSAGE);

    expect(global.localStorage.getItem('loggedIn')).toBeNull();
    expect(global.sessionStorage.getItem('loggedIn')).toBeNull();
    expect(global.localStorage.getItem('user')).toBeNull();
    expect(global.sessionStorage.getItem('user')).toBeNull();
  });
});
