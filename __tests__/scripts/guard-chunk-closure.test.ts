/**
 * #1749: гейт целостности web-выпуска.
 *
 * Прод падал на /map в корневом ErrorBoundary с «Requiring unknown module "1947"»:
 * async-цель `import()` оказалась ВНУТРИ shared-чанка, рантайм грузил этот чанк на
 * маршруте, чей HTML его не вёз, а соседний shared-чанк с синхронной зависимостью
 * не приезжал ни оттуда, ни из манифеста. Бюджеты и SEO-проверки такой выпуск
 * пропускали: по размеру и разметке он безупречен.
 *
 * #2741: с granular-чанкингом Expo набор файлов import() — массив в `paths`
 * модуля, своего манифеста у чанков больше нет.
 */

import fs from 'fs'
import path from 'path'
import { makeTempDir, runNodeCli } from './cli-test-utils'

const ROOT = path.resolve(__dirname, '..', '..')
const GUARD = path.join(ROOT, 'scripts/guard-chunk-closure.js')

const JS_DIR = '_expo/static/js/web'
const { prelude } = require('../../scripts/lib/webChunkMetadataCodec')

type ChunkSpec = { name: string; source: string }

const writeExport = (
  dir: string,
  { chunks, html }: { chunks: ChunkSpec[]; html: Record<string, string[]> },
) => {
  fs.mkdirSync(path.join(dir, JS_DIR), { recursive: true })
  for (const chunk of chunks) {
    fs.writeFileSync(path.join(dir, JS_DIR, chunk.name), chunk.source)
  }
  for (const [file, scripts] of Object.entries(html)) {
    const tags = scripts.map((src) => `<script src="/${JS_DIR}/${src}"></script>`).join('')
    fs.writeFileSync(path.join(dir, file), `<html><body>${tags}</body></html>`)
  }
}

/** Модуль в формате метро-выпуска: фабрика, id, карта зависимостей. */
const moduleDef = (id: number, deps: Record<string, number>, paths?: Record<number, string | string[]> | [string, number]) => {
  const map: Record<string, unknown> = { ...deps }
  if (paths) map.paths = paths
  return `__d(function(g,r,i,a,m,e,d){},${id},${JSON.stringify(map)});`
}

/** Корень страницы: entry исполняет модуль сам. */
const run = (id: number) => `__r(${id});`

describe('guard-chunk-closure', () => {
  const compactExport = (dir: string, scripts = ['runtime.js', 'entry.js'], includeDependency = true) => {
    const table = { v: 'mc1', f: [`/${JS_DIR}/shared.js`, `/${JS_DIR}/route.js`], c: [[0, 1]], m: [{ 7: 0 }], p: '' }
    writeExport(dir, {
      chunks: [
        { name: 'runtime.js', source: prelude(table) },
        { name: 'entry.js', source: moduleDef(1, { 0: 7 }, ['mc1', 0]) + run(1) },
        { name: 'route.js', source: moduleDef(7, { 0: 8 }) },
        { name: 'shared.js', source: includeDependency ? moduleDef(8, {}) : '' },
      ], html: { 'index.html': scripts },
    })
  }

  it('proves the same closure from emitted compact paths and their runtime table', () => {
    const dir = makeTempDir('chunk-closure-compact')
    compactExport(dir)
    expect(runNodeCli([GUARD, dir]).status).toBe(0)
  })

  it('does not hide a missing dependency behind a valid compact descriptor', () => {
    const dir = makeTempDir('chunk-closure-compact-gap')
    compactExport(dir, undefined, false)
    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('модуль 7 требует 8')
  })

  it.each([
    [['entry.js'], 'missing-runtime'],
    [['entry.js', 'runtime.js'], 'runtime-order'],
  ])('requires runtime metadata before importing compact chunks: %j', (scripts, reason) => {
    const dir = makeTempDir('chunk-closure-compact-runtime')
    compactExport(dir, scripts as string[])
    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(reason as string)
  })

  it('fails closed for an unknown descriptor version', () => {
    const dir = makeTempDir('chunk-closure-compact-version')
    compactExport(dir)
    const file = path.join(dir, JS_DIR, 'entry.js')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('["mc1",0]', '["mc2",0]'))
    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('descriptor version')
  })

  it.each([
    '__d(function(){var diagnostic="__mtc1"},1,[]);__r(1);',
    `__d(function(){var diagnostic=${JSON.stringify('{"paths":["mc1",0]}')};},1,[]);__r(1);`,
    '__d(function(){globalThis["__mtc1"]()},1,[]);__r(1);',
  ])('does not require compact runtime for legacy app code: %s', (source) => {
    const dir = makeTempDir('chunk-closure-legacy-compact-text')
    writeExport(dir, { chunks: [{ name: 'entry.js', source }], html: { 'index.html': ['entry.js'] } })
    expect(runNodeCli([GUARD, dir]).status).toBe(0)
  })

  it('fails closed for a real compact descriptor without any runtime registry', () => {
    const dir = makeTempDir('chunk-closure-compact-no-registry')
    compactExport(dir, ['entry.js'])
    fs.unlinkSync(path.join(dir, JS_DIR, 'runtime.js'))
    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing registry')
  })

  it('requires runtime for an actual top-level compact completion call', () => {
    const dir = makeTempDir('chunk-closure-compact-completion')
    writeExport(dir, {
      chunks: [{ name: 'entry.js', source: moduleDef(1, {}) + run(1) + 'globalThis["__mtc1"]();' }],
      html: { 'index.html': ['entry.js'] },
    })
    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing-runtime')
  })

  it('пропускает выпуск, где async-цель везёт свои синхронные зависимости', () => {
    const dir = makeTempDir('chunk-closure-ok')
    writeExport(dir, {
      chunks: [
        {
          name: 'route-aaa.js',
          source: moduleDef(1, { 0: 100 }, { 100: [`/${JS_DIR}/shared-b.js`, `/${JS_DIR}/shared-a.js`] }) + run(1),
        },
        { name: 'shared-a.js', source: moduleDef(100, { 0: 200 }) },
        { name: 'shared-b.js', source: moduleDef(200, {}) },
      ],
      html: { 'map.html': ['route-aaa.js'] },
    })

    const result = runNodeCli([GUARD, dir])
    expect(result.stdout).toContain('замыкание полное')
    expect(result.status).toBe(0)
  })

  it('валит выпуск, где shared-чанк приезжает как async-цель без соседа', () => {
    const dir = makeTempDir('chunk-closure-async-gap')
    writeExport(dir, {
      chunks: [
        {
          name: 'route-aaa.js',
          source: moduleDef(1, { 0: 100 }, { 100: `/${JS_DIR}/shared-a.js` }) + run(1),
        },
        // Ровно прод-случай: сосед с модулем 200 не входит в набор import().
        { name: 'shared-a.js', source: moduleDef(100, { 0: 200 }) },
        { name: 'shared-b.js', source: moduleDef(200, {}) },
      ],
      html: { 'map.html': ['route-aaa.js'] },
    })

    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('async')
    expect(result.stderr).toContain('модуль 100 требует 200')
  })

  it('валит выпуск, где стартовому набору маршрута не хватает определения', () => {
    const dir = makeTempDir('chunk-closure-eager-gap')
    writeExport(dir, {
      chunks: [
        { name: 'route-aaa.js', source: moduleDef(1, { 0: 2 }) + run(1) },
        { name: 'shared-a.js', source: moduleDef(2, {}) },
      ],
      html: { 'map.html': ['route-aaa.js'] },
    })

    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('eager')
    expect(result.stderr).toContain('модуль 1 требует 2')
  })

  it('не считает async-ребро синхронной зависимостью', () => {
    const dir = makeTempDir('chunk-closure-async-edge')
    writeExport(dir, {
      chunks: [
        {
          name: 'route-aaa.js',
          // 100 — цель import(), её определения на странице быть не обязано.
          source: moduleDef(1, { 0: 100 }, { 100: `/${JS_DIR}/shared-a.js` }) + run(1),
        },
        { name: 'shared-a.js', source: moduleDef(100, {}) },
      ],
      html: { 'map.html': ['route-aaa.js'] },
    })

    expect(runNodeCli([GUARD, dir]).status).toBe(0)
  })

  it('не требует зависимостей у модуля, который файл везёт, но маршрут не исполняет', () => {
    const dir = makeTempDir('chunk-closure-unexecuted')
    writeExport(dir, {
      chunks: [
        // 5 лежит в том же granular-файле, но из корня 1 недостижим.
        { name: 'route-aaa.js', source: moduleDef(1, {}) + moduleDef(5, { 0: 999 }) + run(1) },
      ],
      html: { 'map.html': ['route-aaa.js'] },
    })

    expect(runNodeCli([GUARD, dir]).status).toBe(0)
  })

  it('отказывает, если в скриптах страницы нет корня', () => {
    const dir = makeTempDir('chunk-closure-no-roots')
    writeExport(dir, {
      chunks: [{ name: 'route-aaa.js', source: moduleDef(1, {}) }],
      html: { 'map.html': ['route-aaa.js'] },
    })

    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('нет ни одного __r(id)')
  })

  it('отказывает, если исполняемый корень не определён', () => {
    const dir = makeTempDir('chunk-closure-missing-root')
    writeExport(dir, {
      chunks: [{ name: 'entry.js', source: moduleDef(1, {}) + run(999) }],
      html: { 'index.html': ['entry.js'] },
    })
    const result = runNodeCli([GUARD, dir])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('модуль 999 требует 999')
  })

  it('не принимает app-строку или отложенный вызов за исполняемый корень', () => {
    const dir = makeTempDir('chunk-closure-root-string')
    writeExport(dir, {
      chunks: [{ name: 'entry.js', source: moduleDef(1, {})
        + 'var text="__r(999)";var later=function(){__r(998)};' + run(1) }],
      html: { 'index.html': ['entry.js'] },
    })
    expect(runNodeCli([GUARD, dir]).status).toBe(0)
  })
})
