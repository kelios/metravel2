import { baseStyles } from '@/components/travel/stableContent/webStyles/base'
import { imageGridStyles } from '@/components/travel/stableContent/webStyles/imageGrids'
import { groupConsecutiveImages } from '@/utils/richTextImageLayout'

/**
 * #1233: у `contain`-фото в теле статьи поля закрывала нейтральная заливка темы, и
 * портрет висел в пустой светлой рамке — на `/travels/zabroshennye-dvortsy-…` так
 * выглядели все 37 кадров. По правилу `ImageCardMedia` поля должен закрывать
 * доминантный цвет кадра; его ставит `useWebEffects` из УЖЕ загруженной картинки,
 * поэтому второго сетевого запроса не появляется — именно из-за него в #1208/#1213
 * убрали размытую подложку.
 *
 * Проверяем сам CSS-контракт: переменная и обязательный fallback. Посчитать цвет в
 * jsdom нельзя (canvas там не реализован), а на чужом origin `getImageData` бросает
 * SecurityError — обе ветки обязаны оставлять рамку на нейтрале, а не на пустоте.
 */
describe('rich-image-frame letterbox fill (#1233)', () => {
  const NEUTRAL = '#f9f8f6'
  const CLS = 'travel-rich-text'
  const css = baseStyles(
    {
      backgroundSecondary: NEUTRAL,
      text: '#111111',
      textMuted: '#666666',
      border: '#e0e0e0',
      primary: '#2e7d5b',
    } as never,
    CLS,
    `${CLS}-full`,
  )

  const selector = `.${CLS} .rich-image-frame {`
  const start = css.indexOf(selector)
  const frameRule = start < 0 ? '' : css.slice(start, css.indexOf('}', start))

  it('has the frame rule at all — the selector is the anchor of this contract', () => {
    expect(start).toBeGreaterThan(-1)
  })

  it('fills the frame from the dominant-colour variable', () => {
    expect(frameRule).toContain('--travel-rich-image-fill')
  })

  it('keeps the neutral surface as fallback, so an unreadable canvas is not a hole', () => {
    expect(frameRule).toContain(`var(--travel-rich-image-fill, ${NEUTRAL})`)
  })

  // #1208/#1213: второй растр слота не возвращаем — заливка обязана быть цветом,
  // а не копией фотографии в `background-image`.
  it('never puts a photo url back into the frame background', () => {
    expect(frameRule).not.toContain('background-image')
    expect(frameRule).not.toContain('url(')
  })
})

/**
 * Регресс #1233: заливка доехала до прода мёртвой. `.rich-image-frame` читал
 * переменную, но ячейку раскладки красит собственное правило с лишним классом в
 * селекторе (`.img-row-2 p`, `.img-grid p`, …) — по специфичности оно перебивало
 * рамку и возвращало нейтрал. Замер прода 2026-08-04: 59/59 и 18/18 рамок мимо заливки.
 *
 * Контракт формулируем не через один селектор, а через инвариант: ЛЮБОЕ правило
 * журнальной сетки, которое красит фон ячейки, обязано читать ту же переменную с
 * нейтралом в fallback. Иначе добавление новой раскладки снова тихо гасит заливку.
 */
describe('magazine grid cell letterbox fill (#1233)', () => {
  const NEUTRAL = '#f9f8f6'
  const CLS = 'travel-rich-text'
  const css = imageGridStyles(
    { backgroundSecondary: NEUTRAL, borderLight: '#e8e6e1', boxShadows: { light: 'none' } } as never,
    CLS,
  )

  // Все объявления `background:` в сетках — кроме `transparent` у самой картинки.
  const backgroundDeclarations = css
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('background:'))
    .filter((line) => !line.includes('transparent'))

  it('has cell background rules at all — they are the anchor of this contract', () => {
    expect(backgroundDeclarations.length).toBeGreaterThan(0)
  })

  it('every cell background reads the dominant-colour variable with the neutral fallback', () => {
    for (const declaration of backgroundDeclarations) {
      expect(declaration).toBe(`background: var(--travel-rich-image-fill, ${NEUTRAL});`)
    }
  })

  it('never puts a photo url back into a cell background', () => {
    expect(css).not.toContain('background-image')
    expect(css).not.toContain('url(')
  })

  // Одиночное фото обёртки-сетки не получает: оно остаётся абзацем `.rich-image-frame`,
  // и его красит правило рамки, проверенное выше.
  it('leaves a lone image paragraph outside the grids, on the frame rule', () => {
    const html = '<p>Текст</p><p><img src="https://metravel.by/a.jpg" /></p><p>Ещё текст</p>'
    const result = groupConsecutiveImages(html)
    expect(result).not.toContain('img-row-2')
    expect(result).not.toContain('img-grid')
    expect(result).toMatch(/img-float-(right|left)|img-single-wide/)
  })
})
