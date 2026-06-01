import type { useThemedColors } from '@/hooks/useTheme';

export type QuestColors = ReturnType<typeof useThemedColors>;

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const QUEST_DESIGN = {
    headerGradient: 'linear-gradient(135deg, var(--color-background) 0%, var(--color-primaryDark) 50%, var(--color-background) 100%)',
    cardGlow: '0 8px 32px rgba(245, 132, 44, 0.08), 0 2px 8px rgba(0,0,0,0.04)',
    cardHoverGlow: '0 16px 48px rgba(245, 132, 44, 0.15), 0 4px 12px rgba(0,0,0,0.08)',
    stepActiveGradient: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brandDark) 100%)',
    stepDoneGradient: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-successDark) 100%)',
    titleSize: 28,
    sectionTitleSize: 11,
    bodySize: 15,
};
