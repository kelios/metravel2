/**
 * @deprecated This file is deprecated. Use @/constants/designSystem instead.
 * See docs/DESIGN_SYSTEM_CONSOLIDATION.md for migration guide.
 * This file will be removed in v2.0.0
 * 
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
  // ✅ ИСПРАВЛЕНИЕ: Улучшена контрастность для соответствия WCAG AA (≥4.5:1)
  textPrimary: '#1a1a1a', // Контраст ~16.5:1 на #fcfcfc ✅
  textSecondary: '#4a5568', // Контраст ~7.2:1 ✅
  textTertiary: '#6b7280', // Контраст ~4.8:1 ✅
  
  // Границы (почти невидимые)
  border: 'rgba(0, 0, 0, 0.06)', // Очень мягкая граница
  borderLight: 'rgba(0, 0, 0, 0.04)', // Еще мягче для разделителей
  borderAccent: 'rgba(0, 0, 0, 0.08)', // Нейтральная граница для активных состояний
  
  // Активные состояния (нейтральные серые)
  active: '#1f2937', // Темно-серый для активных состояний
  activeLight: '#6b7280', // Нейтральный серый для акцентов
  
  // Тени (как легкий туман)
  shadowLight: 'rgba(0, 0, 0, 0.03)', // Почти невидимая
  shadowMedium: 'rgba(0, 0, 0, 0.05)', // Легкая глубина
  shadowHeavy: 'rgba(0, 0, 0, 0.08)', // Мягкая глубина для модальных окон
  
  // Специальные цвета для badges (полупрозрачные)
  // ✅ ИСПРАВЛЕНИЕ: Увеличена непрозрачность для лучшего контраста текста
  badgePopular: 'rgba(248, 212, 196, 0.85)', // Более непрозрачный персик для контраста
  badgeNew: 'rgba(196, 232, 212, 0.85)', // Более непрозрачный мятный для контраста
  badgeTrend: 'rgba(212, 227, 245, 0.85)', // Более непрозрачный голубой для контраста
  // Цвет текста для badges (тёмный для контраста на светлых фонах)
  badgeText: '#1a1a1a', // Тёмный текст для контраста на светлых badges
  
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
 * ✅ УЛУЧШЕНИЕ: Упрощенные тени для светлого прозаичного дизайна
 */
export const AIRY_SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
