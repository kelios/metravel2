/** #3292: напоминание о возрасте слепка «похожих» при выкате — предупреждает, но не останавливает. */
import fs from 'fs'
import path from 'path'

import { makeTempDir, runCli } from './cli-test-utils'

const { similarAgeWarning, DEFAULT_MAX_AGE_DAYS } = require('@/scripts/ai-similar-age-warning')

const NOW = Date.parse('2026-11-30T12:00:00.000Z')
const SCRIPT = path.join(process.cwd(), 'scripts/ai-similar-age-warning.js')

const writeArtifact = (dir: string, body: unknown) => {
  const file = path.join(dir, 'ai-similar.json')
  fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body))
  return file
}

describe('ai-similar-age-warning (#3292)', () => {
  it('свежий слепок и отсутствующий файл — молчит: старый коммит без слепка выкатывается без шума', () => {
    const dir = makeTempDir('ai-similar-age-')
    const fresh = writeArtifact(dir, { index_built_at: '2026-11-20T00:00:00.000Z' })
    expect(similarAgeWarning(fresh, { now: NOW })).toBeNull()
    expect(similarAgeWarning(path.join(dir, 'missing.json'), { now: NOW })).toBeNull()
    expect(similarAgeWarning(undefined, { now: NOW })).toBeNull()
  })

  it('старше порога — строка ⚠️ с возрастом и командами обновления; порог задаётся', () => {
    const dir = makeTempDir('ai-similar-age-')
    const old = writeArtifact(dir, { index_built_at: '2026-11-11T10:00:00.000Z' })
    expect(DEFAULT_MAX_AGE_DAYS).toBe(14)
    const warning = similarAgeWarning(old, { now: NOW })
    expect(warning).toMatch(/^⚠️ {2}Слепок «похожих» собран 19 дн\. назад \(порог 14\)/)
    expect(warning).toContain('npm run ai:index -- build')
    expect(warning).toContain('npm run ai:similar:build')
    expect(similarAgeWarning(old, { now: NOW, maxAgeDays: 30 })).toBeNull()
  })

  it('битый файл или слепок без даты — предупреждение, а не «свежо»', () => {
    const dir = makeTempDir('ai-similar-age-')
    expect(similarAgeWarning(writeArtifact(dir, '{не json'), { now: NOW })).toMatch(/не читается/)
    expect(similarAgeWarning(writeArtifact(dir, { version: 1 }), { now: NOW })).toMatch(/не читается/)
  })

  it('как команда: код выхода 0 и при старом слепке, и без аргументов', () => {
    const dir = makeTempDir('ai-similar-age-')
    const old = writeArtifact(dir, { index_built_at: '2020-01-01T00:00:00.000Z' })
    const stale = runCli('node', [SCRIPT, old])
    expect(stale.status).toBe(0)
    expect(stale.stdout).toMatch(/^⚠️ {2}Слепок «похожих» собран \d+ дн\. назад/)
    const none = runCli('node', [SCRIPT])
    expect(none.status).toBe(0)
    expect(none.stdout).toBe('')
  })
})
