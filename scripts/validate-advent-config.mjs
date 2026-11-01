#!/usr/bin/env node
// Гейт конфига адвент-календаря (#2862): `node scripts/validate-advent-config.mjs data/advent/2026.json`.
// Входит в `npm run lint` как `guard:advent-config`. Логика — `scripts/lib/advent-config-validator.js`.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { validateAdventConfig, defaultRouteExists } = require('./lib/advent-config-validator.js')

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] || 'data/advent/2026.json'
const file = path.resolve(rootDir, target)

let config
try {
  config = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch (error) {
  console.error(`advent-config: не удалось прочитать ${target}: ${error.message}`)
  process.exit(1)
}

const errors = validateAdventConfig(config, { routeExists: defaultRouteExists(rootDir) })
if (errors.length) {
  console.error(`advent-config: ${errors.length} ошибок в ${target}`)
  errors.forEach((message) => console.error(`  - ${message}`))
  process.exit(1)
}
console.log(`advent-config: ${target} валиден (${config.doors.length} дверец, ${config.start} — ${config.end})`)
