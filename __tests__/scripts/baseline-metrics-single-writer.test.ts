/**
 * У трекнутого артефакта — ровно один писатель.
 *
 * `BASELINE_METRICS.json` писали двое: `scripts/analyze-bundle.js` (подключён
 * тремя путями) и `scripts/analyze_bundle.py`, у которого не было ни одной точки
 * вызова. Пара была не безобидной: питоновский вариант читал только
 * `dependencies`, поэтому в те же поля писал другие числа — `total` 78 вместо
 * 120 и `dev` всегда 0. Случайный запуск мёртвого скрипта тихо портил бы
 * метрики, по которым потом сравнивают бандл.
 *
 * #1407 починил в обоих писателях завершающий перевод строки и тем самым
 * узаконил саму пару — вопрос «почему их два» тогда не задавался. Этот тест его
 * и задаёт: писатель обязан быть один и обязан быть вызываемым.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const ARTIFACT = 'BASELINE_METRICS.json'
const OWNER = 'scripts/analyze-bundle.js'

/** Примитивы записи в файл — на тех языках, на которых в репозитории пишут скрипты. */
const WRITE_CALL = /writeFileSync|writeFile\(|json\.dump|write_text|>\s*["']?BASELINE_METRICS\.json/

const trackedFiles = () =>
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)

/**
 * Кандидат в писатели — трекнутый файл, который упоминает артефакт и содержит
 * вызов записи. Документация и сам артефакт исключены: упоминание в тексте
 * писателем не делает.
 */
const findWriters = () =>
  trackedFiles()
    .filter((file) => file !== ARTIFACT && !file.startsWith('docs/') && !file.startsWith('__tests__/'))
    .filter((file) => {
      let source: string
      try {
        source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      } catch {
        return false
      }
      return source.includes(ARTIFACT) && WRITE_CALL.test(source)
    })

describe('BASELINE_METRICS.json: один писатель и он вызываемый', () => {
  it('писатель ровно один — и это analyze-bundle.js', () => {
    expect(findWriters()).toEqual([OWNER])
  })

  it('писатель подключён к npm-скрипту, а не лежит мёртвым', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    const entry = Object.entries(pkg.scripts as Record<string, string>).filter(([, cmd]) =>
      cmd.includes('scripts/analyze-bundle.js'),
    )

    expect(entry.length).toBeGreaterThan(0)
  })

  it('пишет и devDependencies тоже — мёртвый python-вариант их терял целиком', () => {
    const source = fs.readFileSync(path.join(ROOT, OWNER), 'utf8')

    // Ровно та строка, которой не было у второго писателя: он брал только
    // dependencies, поэтому dev всегда выходил нулём.
    expect(source).toMatch(/\.\.\.packageJson\.devDependencies/)
  })
})
