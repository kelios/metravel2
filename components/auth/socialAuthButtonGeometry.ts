import { DESIGN_TOKENS } from '@/constants/designSystem';

/** Общая геометрия custom social-auth кнопок на web и native. */
export const SOCIAL_AUTH_BUTTON_GEOMETRY = {
    minHeight: 48,
    borderRadius: DESIGN_TOKENS.radii.lg,
    disabledOpacity: 0.55,
    pressedOpacity: 0.88,
    pressedScale: 0.99,
    contentGap: 12,
    paddingHorizontal: 16,
    fontSize: 16,
} as const;
