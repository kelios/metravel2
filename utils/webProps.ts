import type React from 'react'
import { Platform, type PressableProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native'

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

export type WebOnlyViewStyle = {
  backdropFilter?: React.CSSProperties['backdropFilter']
  boxShadow?: React.CSSProperties['boxShadow']
  cursor?: React.CSSProperties['cursor']
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

/** Нативная web-подсказка `title` для иконки без текста; на native — пусто. */
export const webTitleProps = (title: string): PressableProps =>
  Platform.OS === 'web' ? ({ title } as PressableProps) : {}

/**
 * Метка десктопной шапки экрана (#2099): до гидратации статический HTML несёт её
 * на всех ширинах (h1 должен быть в сыром HTML), а критический CSS прячет метку
 * на телефоне, чтобы после гидратации контент не прыгал вверх.
 */
export const SCREEN_HEADER_DESKTOP_PROPS = webDataSetProps({ screenHeader: 'desktop' })
