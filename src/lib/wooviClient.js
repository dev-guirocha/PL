const { createClient } = require('@woovi/node-sdk');

// Normaliza AppID e permite override de baseUrl via env
const appId = (process.env.WOOVI_APP_ID || '').trim();
const baseUrl = process.env.WOOVI_BASE_URL || 'https://api.woovi.com';

console.log('[Woovi] appId len:', appId.length);
console.log('[Woovi] appId head:', appId.slice(0, 8));

const woovi = createClient({ appId, baseUrl });

module.exports = woovi;
