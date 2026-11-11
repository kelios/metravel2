#!/usr/bin/env node
/**
 * Напоминание при выкате (#3292): слепок «похожих» лежит в репозитории и устаревает молча —
 * новая статья просто остаётся без блока. Печатает строку `⚠️`, если файл старше порога или не
 * читается; отсутствующий файл — молча (коммит до слепка). Выкат не останавливает (код выхода
 * всегда 0) и в сеть не ходит.
 * Полная сверка с каталогом — `npm run guard:ai-index-freshness -- --artifact <файл>`.
 *
 *   node scripts/ai-similar-age-warning.js <файл> [порог в днях, по умолчанию 14]
 */
const fs = require('fs')

const DEFAULT_MAX_AGE_DAYS = 14
const REFRESH_HINT = 'обновить: `npm run ai:index -- build`, затем `npm run ai:similar:build` и коммит файла'

function similarAgeWarning(file, { maxAgeDays = DEFAULT_MAX_AGE_DAYS, now = Date.now() } = {}) {
  if (!file || !fs.existsSync(file)) return null
  let builtAt
  try {
    builtAt = Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).index_built_at)
  } catch {
    builtAt = Number.NaN
  }
  if (!Number.isFinite(builtAt)) return `⚠️  Слепок «похожих» ${file} не читается — ${REFRESH_HINT}`
  const ageDays = Math.max(0, Math.floor((now - builtAt) / 86_400_000))
  if (ageDays <= maxAgeDays) return null
  return `⚠️  Слепок «похожих» собран ${ageDays} дн. назад (порог ${maxAgeDays}): статьи новее остаются без блока — ${REFRESH_HINT}`
}

if (require.main === module) {
  const [file, maxAge] = process.argv.slice(2)
  const maxAgeDays = Number.parseInt(maxAge ?? '', 10)
  const warning = similarAgeWarning(file, Number.isFinite(maxAgeDays) ? { maxAgeDays } : {})
  if (warning) console.log(warning)
}

module.exports = { DEFAULT_MAX_AGE_DAYS, similarAgeWarning }
