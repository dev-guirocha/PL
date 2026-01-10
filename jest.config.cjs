module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  globalSetup: '<rootDir>/__tests__/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/helpers/globalTeardown.js',
  testTimeout: 30000,
};
