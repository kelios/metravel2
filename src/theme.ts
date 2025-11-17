// src/theme.ts
// ✅ ДИЗАЙН: Обновлена тема с максимально легкой и воздушной палитрой
import { AIRY_COLORS, AIRY_SHADOWS } from '@/constants/airyColors';

export const theme = {
    bg: AIRY_COLORS.background,
    card: AIRY_COLORS.surface,
    border: AIRY_COLORS.border,
    text: AIRY_COLORS.textPrimary,
    textMuted: AIRY_COLORS.textSecondary,
    primary: AIRY_COLORS.primary,
    primaryDark: AIRY_COLORS.primaryDark,
    primaryLight: AIRY_COLORS.primaryLight,
    primaryTextOn: AIRY_COLORS.textPrimary,
    success: AIRY_COLORS.success,
    danger: AIRY_COLORS.danger,
    warning: AIRY_COLORS.warning,
    info: AIRY_COLORS.info,
    accent: AIRY_COLORS.accent,
    radius: 16, // ✅ ДИЗАЙН: Увеличен радиус для еще большей мягкости
    shadow: AIRY_SHADOWS.medium, // ✅ ДИЗАЙН: Легкая воздушная тень
};
