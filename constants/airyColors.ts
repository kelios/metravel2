/**
 * ✅ ДИЗАЙН: Максимально легкая и воздушная цветовая палитра
 * Мягкие, почти невесомые цвета с минимальным контрастом
 * Создает ощущение легкости, воздушности и невесомости
 */

export const AIRY_COLORS = {
  // Основные цвета (как легкое утреннее небо)
  primary: '#f8d4c4', // Легкий персиковый облако
  primaryDark: '#f5c4b0', // Чуть более выраженный персик (для hover)
  primaryLight: '#fefaf8', // Почти белый с легким теплом
  
  // Акцентные цвета (как морская дымка)
  accent: '#c8ddd9', // Очень светлый бирюзовый туман
  accentLight: '#e8f3f1', // Почти белый бирюзовый
  
  // Функциональные цвета (максимально мягкие)
  success: '#c4e8d4', // Легкий мятный туман
  danger: '#f5d4d4', // Нежный розовый облако
  warning: '#faf0d4', // Светлый пудровый
  info: '#d4e3f5', // Легкий голубой туман
  
  // Фоны (воздушные слои)
  background: '#fcfcfc', // Почти белый с легкой теплотой
  backgroundSecondary: '#f9f9f9', // Легкий серый туман
  surface: '#ffffff', // Чистый белый для карточек
  surfaceElevated: '#ffffff', // Чистый белый с легкой тенью
  
  // Текст (мягкий, но читаемый)
  textPrimary: '#3a4548', // Мягкий темно-серый
  textSecondary: '#6b7a7d', // Светло-серый
  textTertiary: '#9ba5a8', // Очень светлый серый
  
  // Границы (почти невидимые)
  border: 'rgba(0, 0, 0, 0.04)', // Очень мягкая граница
  borderLight: 'rgba(0, 0, 0, 0.02)', // Еще мягче для разделителей
  borderAccent: 'rgba(248, 212, 196, 0.3)', // Легкий персик для hover
  
  // Тени (как легкий туман)
  shadowLight: 'rgba(0, 0, 0, 0.03)', // Почти невидимая
  shadowMedium: 'rgba(0, 0, 0, 0.05)', // Легкая глубина
  shadowHeavy: 'rgba(0, 0, 0, 0.08)', // Мягкая глубина для модальных окон
  
  // Специальные цвета для badges (полупрозрачные)
  badgePopular: 'rgba(248, 212, 196, 0.4)', // Полупрозрачный персик
  badgeNew: 'rgba(196, 232, 212, 0.4)', // Полупрозрачный мятный
  badgeTrend: 'rgba(212, 227, 245, 0.4)', // Полупрозрачный голубой
  
  // Дополнительные воздушные цвета
  overlay: 'rgba(255, 255, 255, 0.8)', // Светлое наложение
  overlayDark: 'rgba(0, 0, 0, 0.02)', // Очень легкое затемнение
} as const;

/**
 * Градиенты (почти незаметные, очень мягкие)
 */
export const AIRY_GRADIENTS = {
  primary: 'linear-gradient(135deg, rgba(248, 212, 196, 0.3) 0%, rgba(245, 196, 176, 0.2) 100%)',
  accent: 'linear-gradient(135deg, rgba(200, 221, 217, 0.3) 0%, rgba(180, 210, 205, 0.2) 100%)',
  background: 'linear-gradient(180deg, #fcfcfc 0%, #ffffff 100%)',
  surface: 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 1) 100%)',
  overlay: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
} as const;

/**
 * Тени в формате для StyleSheet
 */
export const AIRY_SHADOWS = {
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

/**
 * Box shadows для web (легкие, воздушные)
 */
export const AIRY_BOX_SHADOWS = {
  light: '0 1px 8px rgba(0, 0, 0, 0.03)',
  medium: '0 2px 12px rgba(0, 0, 0, 0.05)',
  heavy: '0 4px 16px rgba(0, 0, 0, 0.08)',
  hover: '0 4px 20px rgba(248, 212, 196, 0.15)', // Легкая персиковая тень при hover
} as const;

/**
 * Хелперы для работы с цветами
 */
export const getAiryColor = (colorName: keyof typeof AIRY_COLORS): string => {
  return AIRY_COLORS[colorName];
};

export const getAiryGradient = (gradientName: keyof typeof AIRY_GRADIENTS): string => {
  return AIRY_GRADIENTS[gradientName];
};

export const getAiryShadow = (shadowName: keyof typeof AIRY_SHADOWS) => {
  return AIRY_SHADOWS[shadowName];
};

export const getAiryBoxShadow = (shadowName: keyof typeof AIRY_BOX_SHADOWS): string => {
  return AIRY_BOX_SHADOWS[shadowName];
};

