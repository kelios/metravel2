/**
 * #1749: гейт целостности web-выпуска.
 *
 * Прод падал на /map в корневом ErrorBoundary с «Requiring unknown module "1947"»:
 * async-цель `import()` оказалась ВНУТРИ shared-чанка, рантайм грузил этот чанк на
 * маршруте, чей HTML его не вёз, а соседний shared-чанк с синхронной зависимостью
 * не приезжал ни оттуда, ни из манифеста. Бюджеты и SEO-проверки такой выпуск
 * пропускали: по размеру и разметке он безупречен.
 */

import fs from 'fs'
import path from 'path'
import { makeTempDir, runNodeCli } from './cli-test-utils'

const ROOT = path.resolve(__dirname, '..', '..')
const GUARD = path.join(ROOT, 'scripts/guard-chunk-closure.js')

const JS_DIR = '_expo/static/js/web'

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
const moduleDef = (id: number, deps: Record<string, number>, paths?: Record<number, string>) => {
  const map: Record<string, unknown> = { ...deps }
  if (paths) map.paths = paths
  return `__d(function(g,r,i,a,m,e,d){},${id},${JSON.stringify(map)});`
}

const manifest = (own: string, required: string[]) =>
  `globalThis.__METRAVEL_CHUNK_DEPS__??={};globalThis.__METRAVEL_CHUNK_DEPS__[${JSON.stringify(
    `/${JS_DIR}/${own}`,
  )}]=${JSON.stringify(required.map((name) => `/${JS_DIR}/${name}`))};`

describe('guard-chunk-closure', () => {
  it('пропускает выпуск, где async-цель везёт свои синхронные зависимости', () => {
    const dir = makeTempDir('chunk-closure-ok')
    writeExport(dir, {
      chunks: [
        {
          name: 'route-aaa.js',
          source: moduleDef(1, { 0: 100 }, { 100: `/${JS_DIR}/shared-a.js` }),
        },
        {
          name: 'shared-a.js',
          source: manifest('shared-a.js', ['shared-b.js']) + moduleDef(100, { 0: 200 }),
        },
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
          source: moduleDef(1, { 0: 100 }, { 100: `/${JS_DIR}/shared-a.js` }),
        },
        // Ровно прод-случай: манифеста нет, сосед с модулем 200 никем не грузится.
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
        { name: 'route-aaa.js', source: moduleDef(1, { 0: 2 }) },
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
          source: moduleDef(1, { 0: 100 }, { 100: `/${JS_DIR}/shared-a.js` }),
        },
        { name: 'shared-a.js', source: moduleDef(100, {}) },
      ],
      html: { 'map.html': ['route-aaa.js'] },
    })

    expect(runNodeCli([GUARD, dir]).status).toBe(0)
  })
})
