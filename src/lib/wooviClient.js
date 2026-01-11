const { createClient } = require('@woovi/node-sdk');

// Normaliza AppID e permite override de baseUrl via env
const appId = (process.env.WOOVI_APP_ID || '').trim();
const baseUrl = process.env.WOOVI_BASE_URL || 'https://api.woovi.com';
const wooviDebug = String(process.env.WOOVI_DEBUG || '').toLowerCase() === 'true';

if (wooviDebug) {
  console.log('[Woovi] appId len:', appId.length);
}

const woovi = createClient({ appId, baseUrl });

module.exports = woovi;
