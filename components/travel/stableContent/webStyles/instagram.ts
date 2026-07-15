import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


export const instagramStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => i18nT('travel:components.travel.stableContent.webStyles.instagram.clearfix_value1_after_content_display_block__2dc1a73c', { value1: cls, value2: cls, value3: cls, value4: DESIGN_TOKENS.spacing.md, value5: DESIGN_TOKENS.spacing.lg, value6: colors.borderLight, value7: colors.surfaceMuted, value8: colors.boxShadows?.light || 'none', value9: cls, value10: cls, value11: cls, value12: cls, value13: cls, value14: cls, value15: cls, value16: cls, value17: cls, value18: cls, value19: colors.surface, value20: cls, value21: DESIGN_TOKENS.spacing.md, value22: DESIGN_TOKENS.spacing.lg, value23: colors.borderLight, value24: colors.surface, value25: colors.surfaceMuted, value26: colors.boxShadows?.light || 'none', value27: cls, value28: cls, value29: colors.textMuted, value30: cls, value31: colors.primaryText || colors.primary || colors.text, value32: cls, value33: cls, value34: cls, value35: colors.textMuted })
