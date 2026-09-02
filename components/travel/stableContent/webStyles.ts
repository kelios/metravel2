import { useThemedColors } from '@/hooks/useTheme'

import { baseStyles } from './webStyles/base'
import { floatStyles } from './webStyles/floats'
import { imageGridStyles } from './webStyles/imageGrids'
import { instagramStyles } from './webStyles/instagram'
import { instagramTrailingStyles } from './webStyles/instagramTrailing'
import { responsiveStyles } from './webStyles/responsive'
import { typographyStyles } from './webStyles/typography'

export const WEB_RICH_TEXT_CLASS = 'travel-rich-text'
export const WEB_RICH_TEXT_FULL_WIDTH_CLASS = 'travel-rich-text--full-width'
export const WEB_RICH_TEXT_STYLES_ID = 'travel-rich-text-styles'

type CssSupportsApi = {
  supports?: (property: string, value: string) => boolean
}

export const supportsWebContainerQueries = (
  cssApi: CssSupportsApi | undefined,
): boolean =>
  typeof cssApi?.supports === 'function' && cssApi.supports('container-type', 'inline-size')

export const getWebRichTextStyles = (
  colors: ReturnType<typeof useThemedColors>,
  supportsContainerQueries = true,
) =>
  baseStyles(colors, WEB_RICH_TEXT_CLASS, WEB_RICH_TEXT_FULL_WIDTH_CLASS) +
  // Раньше `responsiveStyles`: мобильный блок гасит обтекание (`float: none`),
  // и при обратном порядке одиночный портрет уезжал бы в обтекание на телефоне.
  floatStyles(colors, WEB_RICH_TEXT_CLASS, supportsContainerQueries) +
  imageGridStyles(colors, WEB_RICH_TEXT_CLASS) +
  typographyStyles(colors, WEB_RICH_TEXT_CLASS) +
  instagramStyles(colors, WEB_RICH_TEXT_CLASS) +
  responsiveStyles(colors, WEB_RICH_TEXT_CLASS) +
  instagramTrailingStyles(colors, WEB_RICH_TEXT_CLASS)
