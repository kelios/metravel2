/**
 * ✅ ДИЗАЙН: Пастельная цветовая палитра для сайта
 * Мягкие, успокаивающие цвета с умеренной насыщенностью и высокой яркостью
 */

export const PASTEL_COLORS = {
  // Основные цвета
  primary: '#f4a88a', // Пастельный персиковый/коралловый
  primaryDark: '#e8937a', // Более темный пастельный персик (для hover)
  primaryLight: '#fef5f2', // Очень светлый персиковый фон
  
  // Акцентные цвета
  accent: '#8fb3b0', // Пастельный бирюзовый/морской
  accentLight: '#cfe5e3', // Светлый бирюзовый
  
  // Функциональные цвета
  success: '#7dd3a0', // Пастельный мятный зеленый
  danger: '#f5a5a5', // Пастельный кораллово-красный
  warning: '#fdd896', // Пастельный желтый
  info: '#a8c5e6', // Пастельный голубой
  
  // Фоны
  background: '#fafafa', // Очень светлый серый
  backgroundSecondary: '#f5f5f5', // Светло-серый для секций
  surface: '#ffffff', // Чистый белый для карточек
  surfaceElevated: '#fefefe', // Чуть теплее белого
  
  // Текст
  textPrimary: '#2d3748', // Мягкий темно-серый
  textSecondary: '#5a6778', // Мягкий средне-серый
  textTertiary: '#8b95a6', // Светло-серый
  
  // Границы
  border: 'rgba(0, 0, 0, 0.06)', // Очень мягкая граница
  borderLight: 'rgba(0, 0, 0, 0.04)', // Еще мягче для разделителей
  
  // Тени
  shadowLight: 'rgba(0, 0, 0, 0.06)',
  shadowMedium: 'rgba(0, 0, 0, 0.08)',
  shadowHeavy: 'rgba(0, 0, 0, 0.12)',
  
  // Специальные цвета для badges
  badgePopular: '#f4a88a', // Пастельный персик
  badgeNew: '#7dd3a0', // Пастельный мятный
  badgeTrend: '#a8c5e6', // Пастельный голубой
} as const;

/**
 * Градиенты для использования в компонентах
 */
export const PASTEL_GRADIENTS = {
  primary: 'linear-gradient(135deg, #f4a88a 0%, #e8937a 100%)',
  accent: 'linear-gradient(135deg, #8fb3b0 0%, #7ba5a2 100%)',
  background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)',
  surface: 'linear-gradient(180deg, #ffffff 0%, #fefefe 100%)',
} as const;

/**
 * Хелперы для работы с цветами
 */
export const getPastelColor = (colorName: keyof typeof PASTEL_COLORS): string => {
  return PASTEL_COLORS[colorName];
};

export const getPastelGradient = (gradientName: keyof typeof PASTEL_GRADIENTS): string => {
  return PASTEL_GRADIENTS[gradientName];
};

