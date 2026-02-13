// src/hooks/useAccessibility.ts
// ✅ Хук для улучшения доступности компонентов

import { useMemo } from 'react';

export interface AccessibilityProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  accessibilityState?: Record<string, boolean | string | number>;
  accessibilityValue?: { text?: string; min?: number; max?: number; now?: number };
}

/**
 * Хук для получения accessibility пропсов
 */
export function useAccessibility(
  label: string,
  options: {
    hint?: string;
    role?: string;
    state?: Record<string, boolean | string | number>;
    value?: { text?: string; min?: number; max?: number; now?: number };
  } = {}
): AccessibilityProps {
  const { hint, role = 'button', state, value } = options;

  return useMemo(
    () => ({
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: role,
      ...(state && { accessibilityState: state }),
      ...(value && { accessibilityValue: value }),
    }),
    [label, hint, role, state, value]
  );
}

