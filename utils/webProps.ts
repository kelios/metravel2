import type React from 'react'
import { Platform, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native'

type Booleanish = boolean | 'false' | 'true'

export type WebAccessibilityProps = {
  id?: string
  role?: React.AriaRole
  tabIndex?: number
  'aria-busy'?: Booleanish
  'aria-checked'?: Booleanish | 'mixed'
  'aria-describedby'?: string
  'aria-disabled'?: Booleanish
  'aria-expanded'?: Booleanish
  'aria-hidden'?: Booleanish
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-live'?: 'assertive' | 'off' | 'polite'
  'aria-modal'?: Booleanish
  'aria-pressed'?: Booleanish | 'mixed'
  'data-testid'?: string
}

export const webAccessibilityProps = <T extends WebAccessibilityProps>(props: T): T => props

export type WebDataSet = Record<string, string | number | boolean>

/**
 * Типизированный мостик для `dataSet` RN-Web: RN-Web разворачивает его в
 * атрибуты `data-*`, а это единственный стабильный CSS-хук к узлам RN-Web —
 * атомарные классы (`r-…`) генерирует сборка, и опираться на них нельзя.
 * Нужен там, где до-гидрационную раскладку задаёт критический CSS (#1298).
 */
export const webDataSetProps = (dataSet: WebDataSet): { dataSet: WebDataSet } => ({ dataSet })

/** Кадры RN-Web: имя готового `@keyframes` либо объект «шаг → стиль». */
export type WebAnimationKeyframes = string | Record<string, ViewStyle>

export type WebOnlyViewStyle = {
  animationDuration?: React.CSSProperties['animationDuration']
  animationIterationCount?: React.CSSProperties['animationIterationCount']
  /**
   * Только внутри `StyleSheet.create`: из инлайн-стиля RN-Web этот ключ не
   * компилирует, и анимация молча не работает (#2170).
   */
  animationKeyframes?: WebAnimationKeyframes | WebAnimationKeyframes[]
  animationTimingFunction?: React.CSSProperties['animationTimingFunction']
  backdropFilter?: React.CSSProperties['backdropFilter']
  backgroundImage?: React.CSSProperties['backgroundImage']
  boxShadow?: React.CSSProperties['boxShadow']
  cursor?: React.CSSProperties['cursor']
  gridTemplateColumns?: React.CSSProperties['gridTemplateColumns']
  minHeight?: React.CSSProperties['minHeight']
  outlineColor?: React.CSSProperties['outlineColor']
  outlineStyle?: React.CSSProperties['outlineStyle']
  outlineWidth?: React.CSSProperties['outlineWidth']
  overflowX?: React.CSSProperties['overflowX']
  position?: React.CSSProperties['position']
  touchAction?: React.CSSProperties['touchAction']
  transition?: React.CSSProperties['transition']
  transitionDuration?: React.CSSProperties['transitionDuration']
  transitionProperty?: React.CSSProperties['transitionProperty']
  transitionTimingFunction?: React.CSSProperties['transitionTimingFunction']
  WebkitBackdropFilter?: React.CSSProperties['WebkitBackdropFilter']
  willChange?: React.CSSProperties['willChange']
}

/** Typed RN-Web compatibility boundary for CSS properties absent from ViewStyle. */
export const webViewStyle = (
  style: Omit<ViewStyle, keyof WebOnlyViewStyle> & WebOnlyViewStyle,
): ViewStyle => style as ViewStyle

export type WebOnlyTextStyle = {
  fontVariantNumeric?: React.CSSProperties['fontVariantNumeric']
  outlineColor?: React.CSSProperties['outlineColor']
  outlineStyle?: React.CSSProperties['outlineStyle']
  outlineWidth?: React.CSSProperties['outlineWidth']
  overflow?: React.CSSProperties['overflow']
  overflowWrap?: React.CSSProperties['overflowWrap']
  textOverflow?: React.CSSProperties['textOverflow']
  transition?: React.CSSProperties['transition']
  whiteSpace?: React.CSSProperties['whiteSpace']
  wordBreak?: React.CSSProperties['wordBreak']
}

/** Typed RN-Web compatibility boundary for CSS properties absent from TextStyle. */
export const webTextStyle = (
  style: Omit<TextStyle, keyof WebOnlyTextStyle> & WebOnlyTextStyle,
): TextStyle => style as TextStyle

/**
 * Широкий RN-Web мостик: RN `ViewStyle` + ЛЮБОЕ web-CSS свойство. В отличие от
 * `webViewStyle` (курируемый безопасный список из ~12 свойств) принимает весь
 * `Partial<CSSProperties>` — заменяет россыпь `style as any` там, где нужен
 * произвольный web-CSS. Единственный `as` локализован здесь и БЕЗ `any`, поэтому
 * guard:type-debt его не считает; на сам объект TS-проверки сохраняются. (FE-ARCH T1)
 *
 * @example const s = webStyle({ ...styles.card, display: 'grid', cursor: 'pointer' })
 */
export type WebStyle = ViewStyle & Partial<React.CSSProperties>

export const webStyle = (style: WebStyle): ViewStyle => style as ViewStyle

/**
 * Заголовок первого уровня: на web — настоящий `h1` (SEO, скринридер), на native —
 * `accessibilityRole="header"`. `aria-level` RN-типы не знают, мост локализован здесь.
 */
export const headingLevel1Props = (): TextProps =>
  Platform.OS === 'web'
    ? ({ role: 'heading', 'aria-level': 1 } as TextProps)
    : { accessibilityRole: 'header' }

type WebTitleNode = {
  setAttribute?: (name: string, value: string) => void
  removeAttribute?: (name: string) => void
}

/**
 * Ставит DOM-атрибут `title` на узел; пустой текст атрибут снимает. Для компонента
 * со своим ref (`CardActionPressable`); остальным хватает `webTitleRef`.
 */
export const applyWebTitle = (node: unknown, title?: string | null): void => {
  const target = node as WebTitleNode | null | undefined
  if (!target?.setAttribute) return
  if (title) target.setAttribute('title', title)
  else target.removeAttribute?.('title')
}

// Колбэк на текст: тот же текст — тот же ref, и React перевызывает его только при
// смене подсказки. Тексты — подписи интерфейса; потолок страхует от динамических.
const WEB_TITLE_REF_LIMIT = 500
const webTitleRefs = new Map<string, (node: unknown) => void>()
const clearWebTitle = (node: unknown): void => applyWebTitle(node, null)

/**
 * Браузерная подсказка наведения `title` (#2261). react-native-web 0.21.2 проп
 * `title` до DOM не доносит (его нет в `forwardedProps`), и запасного канала, как
 * `dataSet` у `data-*`, у него нет — атрибут ставится на узел по ref:
 * `<Pressable ref={webTitleRef(label)} …>`. Не хук: годится в `map` и в условной
 * ветке. Смена текста обновляет атрибут, пустой текст снимает; на native — `undefined`.
 * Спред `{...({ title } as any)}` запрещён `guard:web-style-channels`.
 */
export const webTitleRef = <T = unknown>(title?: string | null): React.RefCallback<T> | undefined => {
  if (Platform.OS !== 'web') return undefined
  if (!title) return clearWebTitle
  let ref = webTitleRefs.get(title)
  if (!ref) {
    if (webTitleRefs.size >= WEB_TITLE_REF_LIMIT) webTitleRefs.clear()
    ref = (node) => applyWebTitle(node, title)
    webTitleRefs.set(title, ref)
  }
  return ref
}

/**
 * Метка десктопной шапки экрана (#2099): до гидратации статический HTML несёт её
 * на всех ширинах (h1 должен быть в сыром HTML), а критический CSS прячет метку
 * на телефоне, чтобы после гидратации контент не прыгал вверх.
 */
export const SCREEN_HEADER_DESKTOP_PROPS = webDataSetProps({ screenHeader: 'desktop' })

/** Search fields announce their purpose on both RN and the web DOM. */
export const searchInputAccessibilityProps = (): TextInputProps =>
  Platform.OS === 'web' ? { role: 'searchbox' } : { accessibilityRole: 'search' }
