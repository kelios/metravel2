#!/usr/bin/env node
// Гейт конфига адвент-календаря (#2862) и накладок переводов (#2883):
// `node scripts/validate-advent-config.mjs [data/advent/2026.json]` проверяет RU-конфиг
// и все `data/advent/2026.<loc>.json` рядом с ним. Входит в `npm run lint` как
// `guard:advent-config`. Логика — `scripts/lib/advent-config-validator.js`.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { validateAdventConfig, validateAdventOverlay, defaultRouteExists } = require('./lib/advent-config-validator.js')

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] || 'data/advent/2026.json'
const file = path.resolve(rootDir, target)

const readJson = (absolutePath, label) => {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    console.error(`advent-config: не удалось прочитать ${label}: ${error.message}`)
    process.exit(1)
  }
}

const report = (label, errors) => {
  if (!errors.length) return false
  console.error(`advent-config: ${errors.length} ошибок в ${label}`)
  errors.forEach((message) => console.error(`  - ${message}`))
  return true
}

const config = readJson(file, target)
let failed = report(target, validateAdventConfig(config, { routeExists: defaultRouteExists(rootDir) }))

const base = path.basename(file, '.json')
const overlayPattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.([a-z]{2})\\.json$`)
const overlays = fs
  .readdirSync(path.dirname(file))
  .map((name) => ({ name, match: name.match(overlayPattern) }))
  .filter((entry) => entry.match)
  .sort((a, b) => a.name.localeCompare(b.name))

for (const { name, match } of overlays) {
  const overlayPath = path.join(path.dirname(file), name)
  const label = path.relative(rootDir, overlayPath)
  const overlay = readJson(overlayPath, label)
  failed = report(label, validateAdventOverlay(overlay, config, { locale: match[1] })) || failed
}

if (failed) process.exit(1)
console.log(
  `advent-config: ${target} валиден (${config.doors.length} дверец, ${config.start} — ${config.end}); накладок переводов: ${overlays.length}${overlays.length ? ` (${overlays.map((o) => o.match[1]).join(', ')})` : ''}`,
)
