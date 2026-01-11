const fs = require('fs');
const path = require('path');

const readFile = (...parts) => fs.readFileSync(path.resolve(__dirname, '..', ...parts), 'utf8');

describe('frontend token storage', () => {
  test('AuthPage does not persist token in storage', () => {
    const authPage = readFile('src', 'pages', 'AuthPage.jsx');
    expect(authPage).not.toMatch(/setItem\(['"]token['"]/);
    expect(authPage).not.toMatch(/getItem\(['"]token['"]/);
  });

  test('api client does not inject Authorization from localStorage', () => {
    const apiFile = readFile('src', 'utils', 'api.js');
    expect(apiFile).not.toMatch(/Authorization/);
    expect(apiFile).not.toMatch(/getItem\(['"]token['"]/);
  });
});
