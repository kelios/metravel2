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
 * переменную, но ячейку ряда красит собственное правило `.img-jrow > p` с лишним
 * классом в селекторе — по специфичности оно перебивало рамку и возвращало нейтрал.
 * А под `.img-jrow` попадает КАЖДЫЙ абзац-картинка, включая одиночный, так что мимо
 * заливки проходили все фото тела статьи (замер прода 2026-08-04: 59/59 и 18/18 рамок
 * — ячейки jrow, залитых нет).
 */
describe('justified-row cell letterbox fill (#1233)', () => {
  const NEUTRAL = '#f9f8f6'
  const CLS = 'travel-rich-text'
  const css = imageGridStyles(
    { backgroundSecondary: NEUTRAL, borderLight: '#e8e6e1', boxShadows: { light: 'none' } } as never,
    CLS,
  )

  const selector = `.${CLS} .img-jrow > p {`
  const start = css.indexOf(selector)
  const cellRule = start < 0 ? '' : css.slice(start, css.indexOf('}', start))

  it('has the cell rule at all — the selector is the anchor of this contract', () => {
    expect(start).toBeGreaterThan(-1)
  })

  it('paints the cell from the same variable the frame sets, with the neutral fallback', () => {
    expect(cellRule).toContain(`var(--travel-rich-image-fill, ${NEUTRAL})`)
  })

  it('never puts a photo url back into the cell background', () => {
    expect(cellRule).not.toContain('background-image')
    expect(cellRule).not.toContain('url(')
  })

  // Это и есть причина, по которой правило выше обязано читать переменную: под jrow
  // уходит даже одиночное фото, поэтому «случая вне ряда» для тела статьи почти нет.
  it('wraps even a lone image paragraph into a row, so the cell rule is the common path', () => {
    const html = '<p>Текст</p><p><img src="https://metravel.by/a.jpg" /></p><p>Ещё текст</p>'
    expect(groupConsecutiveImages(html)).toContain('img-jrow')
  })
})
