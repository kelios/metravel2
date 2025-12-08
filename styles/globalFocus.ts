/**
 * ✅ ИСПРАВЛЕНИЕ: Глобальные стили для focus-индикаторов
 * Обеспечивает видимую обратную связь при навигации с клавиатуры
 * Соответствует WCAG 2.1 требованиям для доступности
 */

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { MODERN_MATTE_PALETTE } from '@/constants/modernMattePalette'

export const globalFocusStyles = StyleSheet.create({
  /**
   * Базовый стиль для всех интерактивных элементов
   * Добавляет видимый outline при focus на веб-платформе
   */
  focusable: {
    ...Platform.select({
      web: {
        // outline стили будут добавлены через CSS классы
      } as any,
    }),
  },
  /**
   * Альтернативный стиль с более заметным outline
   * Используется для критически важных элементов
   */
  focusableStrong: {
    ...Platform.select({
      web: {
        // outline стили будут добавлены через CSS классы
      } as any,
    }),
  },
  /**
   * Стиль для элементов, которые не должны иметь outline
   * Используется редко, только когда outline мешает дизайну
   */
  focusableSubtle: {
    ...Platform.select({
      web: {
        // outline стили будут добавлены через CSS классы
      } as any,
    }),
  },
});

// Web-стили для focus (только на клиенте)
const addFocusStyles = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
      .focusable {
        outline-width: 2px;
        outline-color: transparent;
        outline-style: solid;
        outline-offset: 2px;
        transition: outline 0.2s ease;
      }
      
      .focusable:focus {
        outline-color: ${DESIGN_TOKENS.colors.primary};
      }
      
      .focusableStrong {
        outline-width: 3px;
        outline-color: ${DESIGN_TOKENS.colors.primary};
        outline-style: solid;
        outline-offset: 3px;
        transition: outline 0.2s ease;
        box-shadow: 0 0 0 1px ${DESIGN_TOKENS.colors.primary};
      }
      
      .focusableSubtle {
        outline-width: 1px;
        outline-color: ${DESIGN_TOKENS.colors.focus};
        outline-style: dashed;
        outline-offset: 1px;
        transition: outline 0.2s ease;
      }
    `;
    document.head.appendChild(style);
  }
};

// Вызываем только на клиенте
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') {
    addFocusStyles();
  } else {
    // Для SSR откладываем до монтирования
    setTimeout(addFocusStyles, 0);
  }
}

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

