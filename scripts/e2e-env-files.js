'use strict'

// Единая загрузка env-файлов для E2E.
//
// Раньше это жило только в `playwright.config.ts`, и запуск
// `node scripts/e2e-webserver.js` напрямую собирал бандл БЕЗ `.env.e2e`.
// Расхождение молчаливое и злое: рантайм тестов читал флаг из `.env.e2e`
// (`EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED=false`), а бандл собирался по `.env`
// (`=true`), и `auth-hydration` падал на несуществующей регрессии.
// Оба входа обязаны видеть один и тот же набор значений.
//
// Порядок важен и совпадает с историческим: побеждает ПЕРВОЕ определение,
// поэтому `.env.e2e` перекрывает `.env.dev`, а тот — `.env`. Уже выставленная
// переменная окружения приоритетнее любого файла.

const fs = require('node:fs')
const path = require('node:path')

const E2E_ENV_FILES = ['.env.e2e', '.env.dev', '.env']

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!key) continue
    if (process.env[key] == null || String(process.env[key]).length === 0) {
      process.env[key] = value
    }
  }
}

function applyE2EEnvFiles(rootDir = process.cwd()) {
  for (const fileName of E2E_ENV_FILES) {
    applyEnvFile(path.join(rootDir, fileName))
  }
}

module.exports = {
  E2E_ENV_FILES,
  applyEnvFile,
  applyE2EEnvFiles,
}
