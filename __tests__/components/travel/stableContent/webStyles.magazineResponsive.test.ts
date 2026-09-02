import { floatStyles } from '@/components/travel/stableContent/webStyles/floats'
import { responsiveStyles } from '@/components/travel/stableContent/webStyles/responsive'
import {
  getWebRichTextStyles,
  supportsWebContainerQueries,
} from '@/components/travel/stableContent/webStyles'

/**
 * Мобильный контракт журнальной раскладки.
 *
 * В headless-превью проверить его нельзя: RN-Web не перестраивается под мобильный
 * брейкпоинт, и все ширины схлопываются в 0 независимо от CSS. Поэтому инвариант
 * закрепляем на самой таблице стилей.
 *
 * Суть: на десктопе группа раскладывается сеткой по ориентации и количеству, а на
 * телефоне читаемость важнее — любая сетка становится одной колонкой, а обтекание
 * выключается, иначе портрет занимает половину экрана и текст рядом нечитаем.
 */
const COLORS = {
  backgroundSecondary: '#f9f8f6',
  borderLight: '#e8e6e1',
  boxShadows: { light: 'none' },
} as never

const CLS = 'travel-rich-text'
const CONTAINER_QUERY = '@container (max-width: 560px)'

const MAGAZINE_WRAPPERS = [
  'img-row-2',
  'img-grid',
  'img-grid-mixed',
  'img-stack-landscape',
  'img-pair-portraits',
  'img-pair-mixed',
  'img-pair-balanced',
  'img-pair-grid',
  'img-column-portraits',
  'img-editorial-grid',
  'img-portrait-triptych',
  'img-portrait-quartet',
]

describe('журнальная раскладка на мобильном', () => {
  const mobileCss = responsiveStyles(COLORS, CLS)

  it('гасит обтекание — на узком экране портрет не отжимает текст', () => {
    const block = mobileCss.slice(mobileCss.indexOf('@media (max-width: 768px)'))
    expect(block).toContain(`.${CLS} .img-float-right`)
    expect(block).toContain(`.${CLS} .img-float-left`)
    expect(block).toContain('float: none')
    expect(block).toContain('width: 100%')
  })

  it.each(MAGAZINE_WRAPPERS)('схлопывает %s в одну колонку', (wrapper) => {
    expect(mobileCss).toContain(`.${CLS} .${wrapper}`)
    // одна колонка задаётся либо grid-template-columns, либо flex-direction: column
    expect(mobileCss).toMatch(/grid-template-columns: minmax\(0, 1fr\)|flex-direction: column/)
  })

  it('на самом узком экране (≤420px) сетки принудительно в одну колонку', () => {
    const narrow = mobileCss.slice(mobileCss.indexOf('@media (max-width: 420px)'))
    expect(narrow).toContain('grid-template-columns: minmax(0, 1fr) !important')
  })
})

describe('обтекание одиночного фото на desktop', () => {
  const desktopCss = floatStyles(COLORS, CLS)

  it('использует настоящий float и оставляет тексту не меньше половины колонки', () => {
    expect(desktopCss).toContain(`.${CLS} .img-float-right {\n    float: right`)
    expect(desktopCss).toContain(`.${CLS} .img-float-left {\n    float: left`)
    expect(desktopCss).toContain('width: min(45%, 420px)')
    expect(desktopCss).toContain('max-width: 45%')
    expect(desktopCss).toContain('margin-left: 16px')
    expect(desktopCss).toContain('margin-right: 16px')
    expect(desktopCss).toContain('container-type: inline-size')
    expect(desktopCss).toContain('@container (max-width: 560px)')
    expect(desktopCss).not.toContain('justify-content: flex-end')
  })
})

describe('совместимость container queries', () => {
  it('выбирает fallback при SSR или отсутствии CSS.supports', () => {
    expect(supportsWebContainerQueries(undefined)).toBe(false)
    expect(supportsWebContainerQueries({})).toBe(false)
  })

  it.each([true, false])('проверяет поддержку container-type через CSS.supports (%s)', (supported) => {
    const supports = jest.fn(() => supported)

    expect(supportsWebContainerQueries({ supports })).toBe(supported)
    expect(supports).toHaveBeenCalledWith('container-type', 'inline-size')
  })

  it.each([
    ['по умолчанию', floatStyles(COLORS, CLS), getWebRichTextStyles(COLORS)],
    ['при явном true', floatStyles(COLORS, CLS, true), getWebRichTextStyles(COLORS, true)],
  ])('сохраняет @container блок %s', (_mode, floatCss, sheet) => {
    expect(floatCss).toContain(CONTAINER_QUERY)
    expect(sheet).toContain(CONTAINER_QUERY)
  })

  it('исключает только @container блок для движка без его поддержки', () => {
    const floatCss = floatStyles(COLORS, CLS, false)
    const sheet = getWebRichTextStyles(COLORS, false)

    expect(floatCss).not.toContain(CONTAINER_QUERY)
    expect(sheet).not.toContain(CONTAINER_QUERY)
    expect(floatCss).toContain(`.${CLS} .img-float-right {\n    float: right`)
    expect(floatCss).toContain(`.${CLS} .img-float-left {\n    float: left`)
  })
})

describe('порядок склейки таблицы стилей', () => {
  const sheet = getWebRichTextStyles(COLORS)

  it('обтекание объявлено до мобильного блока, иначе его нечем погасить', () => {
    const floatDeclaration = sheet.indexOf(`.${CLS} .img-single-wide {`)
    const mobileBlock = sheet.indexOf('@media (max-width: 768px)')
    expect(floatDeclaration).toBeGreaterThan(-1)
    expect(mobileBlock).toBeGreaterThan(-1)
    expect(floatDeclaration).toBeLessThan(mobileBlock)
  })

  it('таблица содержит стили обтекания — без них одиночное фото растягивается на колонку', () => {
    expect(sheet).toContain(floatStyles(COLORS, CLS))
  })
})
