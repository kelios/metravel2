/**
 * #1221: SSG-скрипт вставляет og:image своей CJS-копией таблицы ширин. Копия
 * существует потому, что `scripts/generate-seo-pages.js` не импортирует TS-контракт;
 * ровно на таких копиях уже расходились лестницы (#1170, #1220), поэтому расхождение
 * ловится тестом, а не комментарием.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  DERIVATIVE_WIDTHS_BY_ROUTE,
  socialPreviewWidthForRoute,
} from '@/constants/imageContract'

function readScriptMirror(): Map<string, number> {
  const source = readFileSync(
    resolve(__dirname, '..', '..', 'scripts', 'generate-seo-pages.js'),
    'utf8',
  )
  const block = /const SOCIAL_PREVIEW_WIDTH_BY_ROUTE = new Map\(\[([\s\S]*?)\]\);/.exec(source)
  if (!block) throw new Error('SOCIAL_PREVIEW_WIDTH_BY_ROUTE не найден в generate-seo-pages.js')

  const mirror = new Map<string, number>()
  for (const match of block[1].matchAll(/\['([a-z-]+)',\s*(\d+)\]/g)) {
    mirror.set(match[1], Number(match[2]))
  }
  return mirror
}

describe('SSG-зеркало ширин соцпревью совпадает с контрактом (#1221)', () => {
  const mirror = readScriptMirror()

  it('в зеркале перечислены ровно те же роуты, что в контракте', () => {
    expect([...mirror.keys()].sort()).toEqual([...DERIVATIVE_WIDTHS_BY_ROUTE.keys()].sort())
  })

  it('каждая ширина зеркала совпадает с выбором контракта', () => {
    for (const [route, width] of mirror) {
      expect({ route, width }).toEqual({ route, width: socialPreviewWidthForRoute(route) })
    }
  })
})
