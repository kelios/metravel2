/**
 * ✅ ИСПРАВЛЕНИЕ: Глобальные стили для focus-индикаторов
 * Обеспечивает видимую обратную связь при навигации с клавиатуры
 * Соответствует WCAG 2.1 требованиям для доступности
 */

import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const globalFocusStyles = StyleSheet.create({
  /**
   * Базовый стиль для всех интерактивных элементов
   * Добавляет видимый outline при focus на веб-платформе
   */
  focusable: {
    ...Platform.select({
      web: {
        outlineWidth: 2,
        outlineColor: DESIGN_TOKENS.colors.primary,
        outlineStyle: 'solid',
        outlineOffset: 2,
        transition: 'outline 0.2s ease',
      },
    }),
  },
  /**
   * Альтернативный стиль с более заметным outline
   * Используется для критически важных элементов
   */
  focusableStrong: {
    ...Platform.select({
      web: {
        outlineWidth: 3,
        outlineColor: DESIGN_TOKENS.colors.primary,
        outlineStyle: 'solid',
        outlineOffset: 3,
        transition: 'outline 0.2s ease',
        boxShadow: `0 0 0 1px ${DESIGN_TOKENS.colors.primary}`,
      },
    }),
  },
  /**
   * Стиль для элементов, которые не должны иметь outline
   * Используется редко, только когда outline мешает дизайну
   */
  focusableSubtle: {
    ...Platform.select({
      web: {
        outlineWidth: 1,
        outlineColor: DESIGN_TOKENS.colors.focus,
        outlineStyle: 'dashed',
        outlineOffset: 1,
        transition: 'outline 0.2s ease',
      },
    }),
  },
});

/**
 * Хелпер для применения focus стилей к компонентам
 */
export const applyFocusStyles = (baseStyle: any, focusVariant: 'default' | 'strong' | 'subtle' = 'default') => {
  const focusStyle = 
    focusVariant === 'strong' ? globalFocusStyles.focusableStrong :
    focusVariant === 'subtle' ? globalFocusStyles.focusableSubtle :
    globalFocusStyles.focusable;
  
  return [baseStyle, focusStyle];
};

