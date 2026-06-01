import { DESIGN_TOKENS } from '@/constants/designSystem'
import { getInstagramCardStyles } from '@/utils/instagramRichText'
import type { useThemedColors } from '@/hooks/useTheme'

export const instagramTrailingStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
.${cls} .instagram-wrapper {
  width: min(100%, 540px);
  max-width: 540px;
  margin: ${DESIGN_TOKENS.spacing.md}px auto ${DESIGN_TOKENS.spacing.lg}px;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: linear-gradient(180deg, ${colors.surface} 0%, ${colors.surfaceMuted} 100%);
  box-shadow: ${colors.boxShadows?.light || 'none'};
}

.${cls} .instagram-embed {
  display: block;
  width: 100%;
  min-height: 680px;
  border: 0;
  background: ${colors.surfaceMuted};
}

/* Стили для подписей Instagram */
.${cls} .instagram-caption {
  font-size: 14px;
  color: ${colors.textMuted};
  line-height: 1.5;
  width: min(100%, 430px);
  margin: 10px auto 22px;
  text-align: center;
}
.${cls} .instagram-caption-text {
  display: inline;
}

${getInstagramCardStyles(`.${cls}`, colors)}
`
