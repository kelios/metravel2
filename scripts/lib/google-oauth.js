// OAuth2 "installed app" (loopback) flow for using the OWNER's own Google account.
// Avoids the "email not found" problem of adding a service account to GSC/GA4.
// Secrets live ONLY in .secrets/ (gitignored) — nothing is printed or passed via chat.
const fs = require('fs')
const path = require('path')
const http = require('http')
const { exec } = require('child_process')

const SECRETS = path.join(process.cwd(), '.secrets')
const CLIENT_PATH = path.join(SECRETS, 'google-oauth-client.json')
const TOKEN_PATH = path.join(SECRETS, 'google-oauth-token.json')

function hasToken() {
  return fs.existsSync(TOKEN_PATH)
}

function loadClient() {
  if (!fs.existsSync(CLIENT_PATH)) {
    throw new Error(
      'OAuth client not found at .secrets/google-oauth-client.json. ' +
        'Create an OAuth Client ID (type: Desktop app) in Google Cloud Console, ' +
        'download the JSON and save it there.'
    )
  }
  const j = JSON.parse(fs.readFileSync(CLIENT_PATH, 'utf8'))
  const c = j.installed || j.web || j
  if (!c.client_id || !c.client_secret) {
    throw new Error('OAuth client JSON missing client_id/client_secret.')
  }
  return { clientId: c.client_id, clientSecret: c.client_secret }
}

// Refresh an access token from the stored refresh token. Scope is fixed at login time.
async function getAccessToken() {
  const { clientId, clientSecret } = loadClient()
  const tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
  if (!tok.refresh_token) {
    throw new Error('Stored token has no refresh_token. Re-run: npm run stats:login')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tok.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OAuth refresh failed (${res.status}): ${t}`)
  }
  const j = await res.json()
  return { accessToken: j.access_token }
}

function openBrowser(url) {
  const p = process.platform
  const cmd = p === 'win32' ? `start "" "${url}"` : p === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd, () => {})
}

// One-time interactive consent. Starts a loopback server, opens the browser,
// captures the auth code, exchanges it, and saves the refresh token to .secrets/.
async function runLoginFlow(scopes) {
  const { clientId, clientSecret } = loadClient()
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url, 'http://localhost')
        const err = u.searchParams.get('error')
        if (err) {
          res.end('Ошибка авторизации: ' + err)
          server.close()
          return reject(new Error(err))
        }
        const code = u.searchParams.get('code')
        if (!code) {
          res.writeHead(204)
          res.end()
          return
        }
        const redirectUri = `http://localhost:${server.address().port}`
        const tr = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        const tj = await tr.json()
        if (!tr.ok) {
          res.end('Обмен кода не удался. Подробности в терминале.')
          server.close()
          return reject(new Error(JSON.stringify(tj)))
        }
        if (!tj.refresh_token) {
          res.end('Не получили refresh_token. Отзови доступ и повтори (нужен prompt=consent).')
          server.close()
          return reject(new Error('No refresh_token returned. Revoke app access and retry.'))
        }
        fs.mkdirSync(SECRETS, { recursive: true })
        fs.writeFileSync(
          TOKEN_PATH,
          JSON.stringify({ refresh_token: tj.refresh_token, scopes }, null, 2)
        )
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>Готово ✅ Можно закрыть вкладку и вернуться в терминал.</h2>')
        server.close()
        resolve({ ok: true })
      } catch (e) {
        try {
          res.end('Внутренняя ошибка.')
        } catch {
          // response already closed — ignore
        }
        server.close()
        reject(e)
      }
    })
    server.listen(0, () => {
      const port = server.address().port
      const redirectUri = `http://localhost:${port}`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      })
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString()
      console.log('\nОткрываю браузер для авторизации Google…')
      console.log('Если не открылось автоматически — открой ссылку вручную:\n')
      console.log(authUrl + '\n')
      console.log('После «Разрешить» вкладка скажет «Готово», и токен сохранится.\n')
      openBrowser(authUrl)
    })
  })
}

module.exports = { hasToken, getAccessToken, runLoginFlow, TOKEN_PATH, CLIENT_PATH }
