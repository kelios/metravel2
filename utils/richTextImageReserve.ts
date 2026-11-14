// #3414: резерв места под картинку тела статьи — один расчёт на полный рендер
// (`htmlTransform.normalizeImgTags`) и на серверный остров (`TravelDescription` →
// `toInertHtml`). Пока картинка не загружена, её коробку держат `width`/`height`
// и `aspect-ratio`; у острова и полного рендера они обязаны совпасть, иначе
// подмена острова двигает текст. Модуль без санитайза и трансформаций HTML:
// остров стоит на eager-пути страницы статьи.

import { getAttribute, removeAttribute, type HtmlAttribute } from '@/utils/htmlTokens'

/**
 * #1188: 800×450 — это РЕЗЕРВ места до загрузки, а не пропорции кадра. Редакторская
 * разметка почти никогда не несёт width/height, и без пометки оба рендерера считали
 * выдуманные 16:9 настоящими: на web фото вставало в чужой слот (портрет 374×499 в
 * 354×195 — 59% площади пусто), а на native `attrAR` вообще отменял измерение файла.
 * Маркер отличает резерв от объявленных редактором размеров: их трогать нельзя.
 */
const FALLBACK_WIDTH = '800'
const FALLBACK_HEIGHT = '450'
const RICH_TEXT_IMAGE_FALLBACK_MARKER = 'data-aspect-fallback'

export type RichTextImageReserve = {
  width: string
  height: string
  /** Оба размера известны — из разметки редактора или из имени файла. */
  declared: boolean
}

const DIGITS_RE = /^\d+$/
const declaredDimension = (value: string | null | undefined) => (value && DIGITS_RE.test(value) ? value : undefined)
const FILE_NAME_SIZE_RE = /[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i

/** Размеры резерва по атрибутам `<img>` в том виде, в каком их сохранил редактор. */
export const resolveRichTextImageReserve = (attrs: readonly HtmlAttribute[]): RichTextImageReserve => {
  let width = declaredDimension(getAttribute(attrs, 'width'))
  let height = declaredDimension(getAttribute(attrs, 'height'))
  if (!width || !height) {
    const fromFileName = (getAttribute(attrs, 'src') ?? '').match(FILE_NAME_SIZE_RE)
    if (fromFileName) {
      width = width || fromFileName[1]
      height = height || fromFileName[2]
    }
  }
  return { width: width || FALLBACK_WIDTH, height: height || FALLBACK_HEIGHT, declared: Boolean(width && height) }
}

type RichTextImageReserveStyleOptions = {
  /**
   * Запасной резерв уступает пропорции файла средствами CSS (`aspect-ratio: auto W/H`).
   * Полный рендер делает то же скриптом после загрузки (`adoptNaturalImageAspect`),
   * у серверного острова скрипта нет. Объявленные размеры не трогаются нигде.
   */
  naturalRatioAfterLoad?: boolean
}

/** Дописывает в `style` правила резерва; заданное автором остаётся. */
export const applyRichTextImageReserveStyle = (
  attrs: HtmlAttribute[],
  reserve: RichTextImageReserve,
  options?: RichTextImageReserveStyleOptions,
): void => {
  const ratio = `${reserve.width}/${reserve.height}`
  const aspectRatio = options?.naturalRatioAfterLoad && !reserve.declared ? `auto ${ratio}` : ratio
  const style = getAttribute(attrs, 'style') ?? ''
  const ensured = ['display:block', 'height:auto', 'margin:0 auto', `aspect-ratio:${aspectRatio}`]
    .reduce((acc, rule) => (acc.includes(rule) ? acc : acc ? `${acc};${rule}` : rule), style)
  removeAttribute(attrs, 'style')
  attrs.push({ name: 'style', value: ensured })
}

/** Ставит `width`/`height` резерва и маркер запасных размеров. */
export const applyRichTextImageReserveSize = (attrs: HtmlAttribute[], reserve: RichTextImageReserve): void => {
  for (const name of ['width', 'height', RICH_TEXT_IMAGE_FALLBACK_MARKER]) removeAttribute(attrs, name)
  attrs.push({ name: 'width', value: reserve.width }, { name: 'height', value: reserve.height })
  if (!reserve.declared) attrs.push({ name: RICH_TEXT_IMAGE_FALLBACK_MARKER, value: '1' })
}

/** Атрибуты `<img>` серверного острова с резервом полного рендера. */
export const reserveRichTextIslandImage = (source: readonly HtmlAttribute[]): HtmlAttribute[] => {
  const attrs = [...source]
  const reserve = resolveRichTextImageReserve(attrs)
  applyRichTextImageReserveStyle(attrs, reserve, { naturalRatioAfterLoad: true })
  applyRichTextImageReserveSize(attrs, reserve)
  return attrs
}
