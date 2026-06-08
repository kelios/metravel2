#!/usr/bin/env node
// One-time OAuth login for stats access using the owner's Google account.
// Prereq: .secrets/google-oauth-client.json (Desktop-app OAuth client downloaded
// from Google Cloud Console). Run: npm run stats:login
const { runLoginFlow } = require('./lib/google-oauth')

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly', // GSC
  'https://www.googleapis.com/auth/analytics.readonly', // GA4
]

runLoginFlow(SCOPES)
  .then(() => {
    console.log('✅ Токен сохранён в .secrets/google-oauth-token.json')
    console.log('   Теперь работают: npm run stats:gsc  и  npm run stats:ga4')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Ошибка входа:', err.message)
    process.exit(1)
  })
