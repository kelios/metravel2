import { DESIGN_TOKENS } from '@/constants/designSystem';

/**
 * Утилиты для работы с цветами из дизайн-системы
 * Помогают избежать hardcoded цветов и обеспечивают единообразие
 */

const palette = DESIGN_TOKENS.colors;

/**
 * Получить цвет с прозрачностью
 * @param color - Цвет из палитры (hex)
 * @param opacity - Прозрачность от 0 до 1
 * @returns rgba строка
 */
export function withOpacity(color: string, opacity: number): string {
  // Если цвет уже rgba, заменяем opacity
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/g, `${opacity})`);
  }
  
  // Конвертируем hex в rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Получить цвет текста в зависимости от фона
 * @param backgroundColor - Цвет фона
 * @returns Цвет текста (темный или светлый)
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Простая проверка яркости
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  return brightness > 128 ? palette.text : palette.textInverse;
}

/**
 * Готовые цветовые комбинации для частых случаев
 */
export const colorCombinations = {
  // Фоны с прозрачностью
  overlay: {
    light: withOpacity(palette.text, 0.2),
    medium: withOpacity(palette.text, 0.4),
    heavy: withOpacity(palette.text, 0.6),
  },
  
  // Стеклянные эффекты
  glass: {
    background: withOpacity(palette.surface, 0.8),
    border: withOpacity(palette.border, 0.2),
  },
  
  // Состояния
  states: {
    hover: withOpacity(palette.primary, 0.1),
    active: withOpacity(palette.primary, 0.15),
    disabled: withOpacity(palette.disabled, 0.5),
  },
  
  // Тени
  shadows: {
    light: withOpacity(palette.text, 0.06),
    medium: withOpacity(palette.text, 0.08),
    heavy: withOpacity(palette.text, 0.14),
  },
};

/**
 * Заменить hardcoded цвета на цвета из палитры
 * Используется для миграции старого кода
 */
export const colorMigrationMap: Record<string, string> = {
  // Белый
  '#fff': palette.surface,
  '#ffffff': palette.surface,
  'white': palette.surface,
  
  // Черный
  '#000': palette.text,
  '#000000': palette.text,
  'black': palette.text,
  
  // Старый оранжевый primary
  '#ff9f5a': palette.primary,
  '#FF9F5A': palette.primary,
  
  // Серые
  '#f5f5f5': palette.background,
  '#e0e0e0': palette.borderLight,
  '#9e9e9e': palette.textMuted,
  '#757575': palette.textSubtle,
  '#424242': palette.text,
  
  // Прозрачность
  'transparent': palette.transparent,
};

/**
 * Мигрировать hardcoded цвет на цвет из палитры
 * @param color - Hardcoded цвет
 * @returns Цвет из палитры или исходный цвет
 */
export function migrateColor(color: string): string {
  return colorMigrationMap[color.toLowerCase()] || color;
}
