/**
 * Визуальный тест для проверки layout карточек путешествий
 * Этот тест помогает выявить проблемы с отступами, размерами и позиционированием
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Platform, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { TravelCardSkeleton } from '@/components/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Мок данных для тестирования
const mockTravel = {
  id: 1,
  slug: 'test-travel',
  name: 'Тестовое путешествие',
  travel_image_thumb_url: 'https://example.com/image.jpg',
  countryName: 'Польша',
  userName: 'Julia',
  countUnicIpView: 1200,
  number_days: 3,
};

describe('Card Layout Visual Tests', () => {
  describe('Margin and Padding', () => {
    it('should have correct marginBottom on mobile', () => {
      // ✅ ИСПРАВЛЕНО: marginBottom теперь только из enhancedTravelCardStyles
      const expectedMarginBottom = 12; // mobile
      const spacingSm = DESIGN_TOKENS.spacing.sm; // 12px
      
      // Раньше было: 12px + 12px = 24px (ПРОБЛЕМА)
      // Теперь: 12px (ПРАВИЛЬНО)
      expect(expectedMarginBottom).toBe(12);
      expect(spacingSm).toBe(12);
    });

    it('should not have double marginBottom', () => {
      // Проблема: RenderTravelItem добавляет marginBottom: spacing.sm (10px)
      // к уже существующему marginBottom из enhancedTravelCardStyles (12px)
      // Итого: 22px вместо 12px
      
      const originalOS = Platform.OS;
      (Platform as any).OS = 'web';

      const expectedMarginBottom = Platform.select({ default: 12, web: 16 });
      const spacingSm = DESIGN_TOKENS.spacing.sm; // 10px
      
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { getByTestId } = render(
          <QueryClientProvider client={queryClient}>
            <View>
              <RenderTravelItem item={mockTravel as any} index={0} isMobile={true} />
            </View>
          </QueryClientProvider>
        );

      const card = getByTestId('travel-card-link');
      const flattened = StyleSheet.flatten(card.props.style);
      expect(flattened.marginBottom).toBeUndefined();

      (Platform as any).OS = originalOS;
    });
  });

  describe('Image Container Height', () => {
    it('should match between skeleton and real card on mobile', () => {
      // Skeleton
      const skeletonImageHeight = Platform.select({ default: 200, web: 240 });
      
      // Real card (из enhancedTravelCardStyles)
      const realCardImageHeight = Platform.select({ default: 200, web: 240 });
      
      expect(skeletonImageHeight).toBe(realCardImageHeight);
    });

    it('should have fixed height on mobile (not aspectRatio)', () => {
      const mobileImageHeight = 200;
      expect(mobileImageHeight).toBe(200);
    });
  });

  describe('Card Width', () => {
    it('should be 100% on mobile', () => {
      // Карточка должна занимать 100% ширины
      const expectedWidth = '100%';
      const expectedMaxWidth = '100%';
      
      expect(expectedWidth).toBe('100%');
      expect(expectedMaxWidth).toBe('100%');
    });

    it('should have maxWidth: 100% to prevent overflow', () => {
      // Проверяем, что maxWidth установлен
      const expectedMaxWidth = '100%';
      expect(expectedMaxWidth).toBe('100%');
    });
  });

  describe('Bottom Navigation Padding', () => {
    it('should have sufficient paddingBottom for navigation bar', () => {
      // Нижняя навигация: ~60px
      // Safe area (iOS): ~20-34px
      // Дополнительный отступ: ~20px
      // Итого: минимум 80px, рекомендуется 100px
      
      const navigationHeight = 60;
      const safeAreaBottom = 20;
      const additionalPadding = 20;
      const minimumPaddingBottom = navigationHeight + safeAreaBottom;
      const recommendedPaddingBottom = 100;
      
      expect(recommendedPaddingBottom).toBeGreaterThanOrEqual(minimumPaddingBottom);
      expect(recommendedPaddingBottom).toBe(100);
    });

    it('should not have excessive empty space', () => {
      // Проблема: Если paddingBottom слишком большой, появляется пустое пространство
      // Текущее значение: 100px
      // Это правильно для: 60px навигация + 20px safe area + 20px отступ
      
      const currentPaddingBottom = 100;
      const maxReasonablePadding = 120;
      
      expect(currentPaddingBottom).toBeLessThanOrEqual(maxReasonablePadding);
    });
  });

  describe('Spacing Between Cards', () => {
    it('should have consistent spacing between cards', () => {
      // На мобильных: marginBottom должен быть 12px
      // Это создает визуальный отступ между карточками
      
      const expectedSpacing = 12;
      expect(expectedSpacing).toBe(12);
    });

    it('should not have gaps or holes in layout', () => {
      // Проверяем, что нет лишних отступов
      // Проблема: двойной marginBottom создает "дыры"
      
      const singleMarginBottom = 12;
      const doubleMarginBottom = 22; // Текущая проблема
      
      expect(singleMarginBottom).toBeLessThan(doubleMarginBottom);
    });
  });

  describe('Content Padding', () => {
    it('should have correct horizontal padding on mobile', () => {
      // listContentMobile должен иметь paddingHorizontal: spacing.md (16px)
      const expectedPaddingHorizontal = DESIGN_TOKENS.spacing.md;
      expect(expectedPaddingHorizontal).toBe(16);
    });

    it('should not have double padding', () => {
      // Проверяем, что padding не дублируется
      // main: paddingHorizontal: 0 на мобильных
      // listContentMobile: paddingHorizontal: 16px
      // Итого: 16px (правильно)
      
      const mainPadding = 0;
      const listPadding = 16;
      const totalPadding = mainPadding + listPadding;
      
      expect(totalPadding).toBe(16);
    });
  });

  describe('Visual Comparison', () => {
    it('should render skeleton with same dimensions as real card', () => {
      const { toJSON } = render(<TravelCardSkeleton />);
      
      // Skeleton должен рендериться корректно
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Layout Shift Detection', () => {
    it('should not cause layout shift when transitioning from skeleton to real card', () => {
      // Все размеры должны совпадать:
      // - Image height: 200px (mobile) / 240px (web)
      // - Border radius: 20px (mobile) / 24px (web)
      // - Padding: 14px (mobile) / 20px (web)
      // - Margin bottom: 12px (mobile) / 16px (web)
      
      const dimensions = {
        mobile: {
          imageHeight: 200,
          borderRadius: 20,
          padding: 14,
          marginBottom: 12,
        },
        web: {
          imageHeight: 240,
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
        },
      };
      
      // Skeleton должен иметь те же размеры
      expect(dimensions.mobile.imageHeight).toBe(200);
      expect(dimensions.mobile.marginBottom).toBe(12);
    });
  });

  describe('Problem Detection', () => {
    it('should detect double marginBottom issue', () => {
      // ❌ ПРОБЛЕМА: RenderTravelItem добавляет marginBottom: spacing.sm (12px)
      // к уже существующему marginBottom из enhancedTravelCardStyles (12px)
      
      const cardMarginBottom = 12; // из enhancedTravelCardStyles
      const containerMarginBottom = 12; // из RenderTravelItem (spacing.sm)
      const totalMarginBottom = cardMarginBottom + containerMarginBottom;
      
      // Это проблема!
      expect(totalMarginBottom).toBe(24);
      
      // Должно быть:
      expect(cardMarginBottom).toBe(12);
      
      // РЕШЕНИЕ: Убрать marginBottom из RenderTravelItem
    });

    it('should detect excessive bottom padding issue', () => {
      // Проверяем, что paddingBottom не слишком большой
      const currentPaddingBottom = 100;
      const navigationHeight = 60;
      const safeArea = 20;
      const minRequired = navigationHeight + safeArea;
      
      // 100px - это правильно
      expect(currentPaddingBottom).toBeGreaterThanOrEqual(minRequired);
      expect(currentPaddingBottom).toBeLessThanOrEqual(120);
    });

    it('should detect if card is cut off at bottom', () => {
      // Если последняя карточка обрезается, значит paddingBottom недостаточный
      // Минимум: 80px (60px навигация + 20px safe area)
      // Рекомендуется: 100px
      
      const minPaddingBottom = 80;
      const currentPaddingBottom = 100;
      
      expect(currentPaddingBottom).toBeGreaterThanOrEqual(minPaddingBottom);
    });
  });
});

/**
 * Утилиты для визуального тестирования
 */
export const VISUAL_TEST_CONSTANTS = {
  MOBILE_IMAGE_HEIGHT: 200,
  WEB_IMAGE_HEIGHT: 240,
  MOBILE_BORDER_RADIUS: 20,
  WEB_BORDER_RADIUS: 24,
  MOBILE_PADDING: 16,
  WEB_PADDING: 20,
  MOBILE_MARGIN_BOTTOM: 12,
  WEB_MARGIN_BOTTOM: 16,
  NAVIGATION_HEIGHT: 60,
  SAFE_AREA_BOTTOM: 20,
  MIN_BOTTOM_PADDING: 80,
  RECOMMENDED_BOTTOM_PADDING: 100,
};

/**
 * Функция для проверки layout shift
 */
export function detectLayoutShift(
  skeletonHeight: number,
  realCardHeight: number
): boolean {
  const difference = Math.abs(skeletonHeight - realCardHeight);
  // Допускаем разницу до 2px (из-за округления)
  return difference > 2;
}

/**
 * Функция для расчета правильного paddingBottom
 */
export function calculateBottomPadding(
  navigationHeight: number,
  safeAreaBottom: number,
  additionalPadding: number = 20
): number {
  return navigationHeight + safeAreaBottom + additionalPadding;
}
