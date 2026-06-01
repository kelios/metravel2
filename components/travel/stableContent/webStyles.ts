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

export const getWebRichTextStyles = (colors: ReturnType<typeof useThemedColors>) =>
  baseStyles(colors, WEB_RICH_TEXT_CLASS, WEB_RICH_TEXT_FULL_WIDTH_CLASS) +
  floatStyles(colors, WEB_RICH_TEXT_CLASS) +
  imageGridStyles(colors, WEB_RICH_TEXT_CLASS) +
  typographyStyles(colors, WEB_RICH_TEXT_CLASS) +
  instagramStyles(colors, WEB_RICH_TEXT_CLASS) +
  responsiveStyles(colors, WEB_RICH_TEXT_CLASS) +
  instagramTrailingStyles(colors, WEB_RICH_TEXT_CLASS)
