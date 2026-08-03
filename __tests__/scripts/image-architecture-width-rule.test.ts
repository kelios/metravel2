import { rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { runCli } from './cli-test-utils'

const {
  collectMissingWidthCalls,
  findOptimizeWebDisabledLine,
} = require('../../scripts/check-image-architecture.js')

/**
 * #1161: правило «медиа-запрос обязан нести `w`» раньше держалось на комментарии в
 * `utils/imageProxy.ts`, и один и тот же дефект чинили постфактум трижды (#1103,
 * #1113, #1104). Замер прода 2026-07-30 на
 * `travel-image/682/conversions/10f0a8f2….webp`: без параметров 132 344 B, `?w=320`
 * 17 738 B, `?w=96` 2 582 B — плитка 132×132 без ширины стоит в 51 раз дороже.
 *
 * Здесь проверяется сам гейт: что он ловит регресс и что не срабатывает на
 * легитимных формах записи.
 */
const collect = (source: string) => collectMissingWidthCalls('virtual.tsx', source)

describe('check-image-architecture — правило обязательной ширины (#1161)', () => {
  describe('ловит регресс', () => {
    it('optimizeImageUrl без объекта опций', () => {
      const found = collect(`const url = optimizeImageUrl(avatar)`)
      expect(found).toHaveLength(1)
      expect(found[0].reason).toContain('без объекта опций')
    })

    it('optimizeImageUrl с опциями, но без width', () => {
      const found = collect(`optimizeImageUrl(cover, { quality: 70, fit: 'cover' })`)
      expect(found).toHaveLength(1)
      expect(found[0].name).toBe('optimizeImageUrl')
    })

    it('buildResponsiveImageProps, положившийся на молчаливый дефолт maxWidth=1920', () => {
      const found = collect(`buildResponsiveImageProps(src, { quality: 75, sizes: '100vw' })`)
      expect(found).toHaveLength(1)
      expect(found[0].reason).toContain('widths/maxWidth')
    })

    it('опции собраны в переменной, в которой ширины нет', () => {
      const found = collect(`
        const opts = { quality: 70, fit: 'cover' }
        optimizeImageUrl(uri, opts)
      `)
      expect(found).toHaveLength(1)
      expect(found[0].reason).toContain('opts')
    })

    it('обёртка preferring-media вызвана без ширины (опции у неё третьим аргументом)', () => {
      const found = collect(`buildResponsiveImagePropsPreferringMedia(media, base, { quality: 80 })`)
      expect(found).toHaveLength(1)
      expect(found[0].name).toBe('buildResponsiveImagePropsPreferringMedia')
    })
  })

  describe('не даёт ложных срабатываний', () => {
    it('на shorthand-свойстве width', () => {
      expect(collect(`optimizeImageUrl(uri, { width, quality: 75, fit: 'contain' })`)).toEqual([])
    })

    it('на вложенных вызовах и тернарниках внутри аргументов', () => {
      expect(
        collect(`optimizeImageUrl(buildVersionedImageUrl(u, at), {
          width: Math.min(MAX, Math.round(box * dpr)),
          fit: wide ? 'contain' : 'cover',
        })`),
      ).toEqual([])
    })

    it('на опциях из переменной, в которой ширина есть', () => {
      expect(
        collect(`
          const optimizedOptions: ImageOptimizationOptions = { width: size, quality: 75 }
          optimizeImageUrl(baseUrl, optimizedOptions)
        `),
      ).toEqual([])
    })

    it('на spread-опциях: ключи скрыты, гейт не должен становиться неприменимым', () => {
      expect(collect(`optimizeImageUrl(uri, { ...base, quality: 70 })`)).toEqual([])
    })

    it('на объявлении самой функции', () => {
      expect(
        collect(`export function optimizeImageUrl(url: string, options: Options = {}) { return url }`),
      ).toEqual([])
    })

    it('на forwarding-обёртке, типизированной как опции проверяемой функции', () => {
      expect(
        collect(`
          function wrapper(base: string, options: Parameters<typeof buildResponsiveImageProps>[1] = {}) {
            return buildResponsiveImageProps(base, options)
          }
        `),
      ).toEqual([])
    })
  })

  /**
   * #1221: `optimizeWeb={false}` — вторая форма того же дефекта. Проп запрещает
   * `ImageCardMedia` и ресайзить URL, и строить srcSet, поэтому в `<img>` уходит
   * адрес из API как есть, а ownership-роут на запрос без `?w=` отвечает мастером
   * с `no-store`. Замер прода 2026-08-03 на `/places`: 12 из 12 запросов голыми,
   * 615 714 B `stored-master`; те же ключи со ступенью под слот — 468 260 B
   * `immutable`. Эпизод третий (#1115, #1221), поэтому правило в гейте.
   */
  describe('optimizeWeb={false} (#1221)', () => {
    it('ловит проп в JSX и в объекте mediaProps', () => {
      expect(findOptimizeWebDisabledLine('<ImageCardMedia optimizeWeb={false} />')).toBe(1)
      expect(
        findOptimizeWebDisabledLine('const p = {\n  blurBackground: true,\n  optimizeWeb: false,\n}'),
      ).toBe(3)
    })

    it('не срабатывает на объяснении в комментарии — там, где проп как раз сняли', () => {
      expect(
        findOptimizeWebDisabledLine('// #1221: здесь стоял `optimizeWeb: false`\nconst a = 1'),
      ).toBeNull()
      expect(
        findOptimizeWebDisabledLine('/**\n * было `optimizeWeb={false}`\n */\nconst a = 1'),
      ).toBeNull()
      expect(findOptimizeWebDisabledLine('const a = 1 // optimizeWeb: false когда-то')).toBeNull()
    })

    it('не трогает вычисляемое значение — там ширина зависит от типа обложки', () => {
      expect(findOptimizeWebDisabledLine('<Card optimizeWeb={!usesFallbackCover} />')).toBeNull()
      expect(findOptimizeWebDisabledLine('mediaProps={{ optimizeWeb: isRemote }}')).toBeNull()
    })
  })

  // Гейт обязан не только вернуть список, но и уронить прогон ненулевым кодом —
  // иначе он не остановит CI.
  it('падает ненулевым кодом на искусственно внесённом регрессе', () => {
    const root = resolve(__dirname, '..', '..')
    // Проба обязана лежать внутри сканируемого дерева, поэтому временный каталог тут
    // не подходит — файл кладётся в `components/` и удаляется в finally.
    const probe = join(root, 'components', '__image_width_guard_probe__.tsx')

    try {
      writeFileSync(
        probe,
        `import { optimizeImageUrl } from '@/utils/imageOptimization'\nexport const bad = (u: string) => optimizeImageUrl(u, { quality: 70 })\n`,
      )
      const result = runCli(process.execPath, ['scripts/check-image-architecture.js'], { cwd: root })

      expect(result.status).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).toContain('__image_width_guard_probe__')
    } finally {
      rmSync(probe, { force: true })
    }
  })
})
