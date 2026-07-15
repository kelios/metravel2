import { DESIGN_TOKENS } from '@/constants/designSystem'
import { getInstagramCardStyles } from '@/utils/instagramRichText'
import type { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


export const instagramTrailingStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => i18nT('travel:components.travel.stableContent.webStyles.instagramTrailing.value1_instagram_wrapper_width_min_100_540px_bef1a288', { value1: cls, value2: DESIGN_TOKENS.spacing.md, value3: DESIGN_TOKENS.spacing.lg, value4: colors.borderLight, value5: colors.surface, value6: colors.surfaceMuted, value7: colors.boxShadows?.light || 'none', value8: cls, value9: colors.surfaceMuted, value10: cls, value11: colors.textMuted, value12: cls, value13: getInstagramCardStyles(`.${cls}`, colors) })
