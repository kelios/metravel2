import { useWindowDimensions } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

/**
 * Хук для работы с responsive breakpoints
 * Использует единую систему breakpoints из DESIGN_TOKENS
 * 
 * @returns {Object} Объект с флагами для разных размеров экрана
 * 
 * @example
 * const { isMobile, isTablet, isDesktop, width } = useResponsive();
 * 
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return {
    // Флаги размеров экрана
    isMobile: width < DESIGN_TOKENS.breakpoints.mobile, // < 768px
    isTablet: width >= DESIGN_TOKENS.breakpoints.mobile && width < DESIGN_TOKENS.breakpoints.tablet, // 768-1024px
    isDesktop: width >= DESIGN_TOKENS.breakpoints.desktop, // >= 1280px
    isLargeDesktop: width >= 1920,
    
    // Размеры экрана
    width,
    height,
    
    // Ориентация
    isPortrait: height > width,
    isLandscape: width > height,
    
    // Breakpoints для удобства
    breakpoints: DESIGN_TOKENS.breakpoints,
  };
}

/**
 * Хук для получения количества колонок в зависимости от ширины экрана
 * 
 * @param {Object} config - Конфигурация колонок для разных размеров
 * @returns {number} Количество колонок
 * 
 * @example
 * const columns = useResponsiveColumns({
 *   mobile: 1,
 *   tablet: 2,
 *   desktop: 3,
 *   largeDesktop: 4,
 * });
 */
export function useResponsiveColumns(config: {
  mobile?: number;
  tablet?: number;
  desktop?: number;
  largeDesktop?: number;
} = {}) {
  const { isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();

  const defaults = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    largeDesktop: 4,
  };

  const columns = { ...defaults, ...config };

  if (isLargeDesktop) return columns.largeDesktop;
  if (isDesktop) return columns.desktop;
  if (isTablet) return columns.tablet;
  return columns.mobile;
}

/**
 * Хук для получения значения в зависимости от размера экрана
 * 
 * @param {Object} values - Значения для разных размеров экрана
 * @returns {T} Значение для текущего размера экрана
 * 
 * @example
 * const fontSize = useResponsiveValue({
 *   mobile: 14,
 *   tablet: 16,
 *   desktop: 18,
 * });
 */
export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
  default?: T;
}): T | undefined {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  if (isDesktop && values.desktop !== undefined) return values.desktop;
  if (isTablet && values.tablet !== undefined) return values.tablet;
  if (isMobile && values.mobile !== undefined) return values.mobile;
  return values.default;
}
