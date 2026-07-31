import { join, resolve } from 'node:path'

import { makeTempDir, removeDir, runCli, writeJsonFile } from './cli-test-utils'

/**
 * #1178: analyze-режим `guard-eager-web-bundle.js` полгода не имел данных, и это
 * никак не проявлялось.
 *
 * Дампы пишет `metro.config.js` под `ANALYZE_BUNDLE=1`, а писал он их в
 * `os.tmpdir()`. Прод-сборка запускает `build-web-safe.js` с `-c`, и тот на
 * clear-флаге подменяет дочернему процессу `TMPDIR`/`TMP`/`TEMP` на
 * `<repo>/.tmp/expo-export/run-*`, а по завершении удаляет этот каталог. То есть
 * дампы исправно писались — в каталог, который тут же стирался, — а гейт снаружи
 * смотрел в обычный tmpdir и не находил ничего.
 *
 * Теперь каталог задан явно с обеих сторон. Здесь проверяется контракт гейта:
 * отсутствие дампов обязано быть НЕ «зелено», иначе следующая такая пропажа снова
 * пройдёт незамеченной.
 */
const ROOT = resolve(__dirname, '..', '..')
const GUARD = ['scripts/guard-eager-web-bundle.js', '--from-analyze', '--fail']

const runGuard = (dumpDir: string) =>
  runCli(process.execPath, GUARD, { cwd: ROOT, env: { METRO_DUMP_DIR: dumpDir } })

describe('guard:eager-web:analyze — источник данных (#1178)', () => {
  let dumpDir = ''

  beforeEach(() => {
    dumpDir = makeTempDir('eager-analyze-')
  })

  afterEach(() => {
    removeDir(dumpDir)
  })

  it('падает, когда дампов нет, и называет способ их получить', () => {
    const result = runGuard(dumpDir)

    expect(result.status).not.toBe(0)
    const output = `${result.stdout}${result.stderr}`
    expect(output).toContain('no metro-analyze-*.json dumps')
    expect(output).toContain('ANALYZE_BUNDLE=1')
  })

  it('разбирает дамп и считает eager-набор по синхронным рёбрам', () => {
    // entry → sync a; a → async b. `b` в eager-набор попасть не должен.
    writeJsonFile(join(dumpDir, 'metro-analyze-1-3.json'), {
      entry: '/repo/entry.js',
      count: 3,
      mods: [
        ['/repo/entry.js', 1024, ['/repo/a.js']],
        ['/repo/a.js', 2048, []],
        ['/repo/node_modules/react-native-reanimated/index.js', 999_999, []],
      ],
    })

    const result = runGuard(dumpDir)

    expect(result.status).toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('eager bundle')
  })

  // Ровно то, ради чего гейт существует: запрещённый вендор в eager-графе.
  it('падает, когда запрещённый вендор оказался достижим синхронно', () => {
    writeJsonFile(join(dumpDir, 'metro-analyze-2-2.json'), {
      entry: '/repo/entry.js',
      count: 2,
      mods: [
        ['/repo/entry.js', 1024, ['/repo/node_modules/react-native-reanimated/index.js']],
        ['/repo/node_modules/react-native-reanimated/index.js', 4096, []],
      ],
    })

    const result = runGuard(dumpDir)

    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('react-native-reanimated')
  })
})
