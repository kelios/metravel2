import type React from 'react'
import type { TextStyle, ViewStyle } from 'react-native'

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

export type WebOnlyViewStyle = {
  backdropFilter?: React.CSSProperties['backdropFilter']
  boxShadow?: React.CSSProperties['boxShadow']
  cursor?: React.CSSProperties['cursor']
  outlineColor?: React.CSSProperties['outlineColor']
  outlineStyle?: React.CSSProperties['outlineStyle']
  outlineWidth?: React.CSSProperties['outlineWidth']
  overflowX?: React.CSSProperties['overflowX']
  position?: React.CSSProperties['position']
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
  textOverflow?: React.CSSProperties['textOverflow']
  transition?: React.CSSProperties['transition']
  whiteSpace?: React.CSSProperties['whiteSpace']
}

/** Typed RN-Web compatibility boundary for CSS properties absent from TextStyle. */
export const webTextStyle = (
  style: Omit<TextStyle, keyof WebOnlyTextStyle> & WebOnlyTextStyle,
): TextStyle => style as TextStyle
