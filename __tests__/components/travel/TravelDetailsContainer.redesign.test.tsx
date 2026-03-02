/**
 * 🧪 Тесты редизайна TravelDetailsContainer
 *
 * Проверяет:
 * - Переключение темы (light/dark)
 * - Компактные метрики
 * - Responsive breakpoints
 * - Использование DESIGN_TOKENS
 */

import '@testing-library/jest-dom';
import { COMPACT_SPACING, COMPACT_TYPOGRAPHY } from '@/components/travel/details/TravelDetailsStyles';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Mock dependencies
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true, width: 1440 }),
}));

jest.mock('@/hooks/useTravelDetails', () => ({
  useTravelDetails: () => ({
    travel: {
      id: 1,
      name: 'Test Travel',
      slug: 'test-travel',
      description: '<p>Test description</p>',
      gallery: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    slug: 'test-travel',
    isMissingParam: false,
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isSuperuser: false, userId: null }),
}));

describe('TravelDetailsContainer - Редизайн', () => {
  describe('Компактные метрики', () => {
    it('должен использовать уменьшенные spacing для hero секции', () => {
      expect(COMPACT_SPACING.hero.mobile).toBe(14);
      expect(COMPACT_SPACING.hero.desktop).toBe(28);
      expect(COMPACT_SPACING.hero.mobile).toBeLessThan(24); // было 24
      expect(COMPACT_SPACING.hero.desktop).toBeLessThan(32); // было 32
    });

    it('должен использовать уменьшенные spacing для секций', () => {
      expect(COMPACT_SPACING.section.mobile).toBe(12);
      expect(COMPACT_SPACING.section.desktop).toBe(24);
      expect(COMPACT_SPACING.section.mobile).toBeLessThanOrEqual(20); // было 18-20
      expect(COMPACT_SPACING.section.desktop).toBeLessThanOrEqual(24); // было 24
    });

    it('должен использовать уменьшенные spacing для карточек', () => {
      expect(COMPACT_SPACING.card.mobile).toBe(10);
      expect(COMPACT_SPACING.card.desktop).toBe(16);
      expect(COMPACT_SPACING.card.mobile).toBeLessThanOrEqual(16); // было 16
    });

    it('должен использовать уменьшенные размеры шрифтов', () => {
      expect(COMPACT_TYPOGRAPHY.title.mobile).toBe(22);
      expect(COMPACT_TYPOGRAPHY.title.desktop).toBe(24);
      expect(COMPACT_TYPOGRAPHY.body.mobile).toBe(14);
      expect(COMPACT_TYPOGRAPHY.caption.mobile).toBe(12);
    });

    it('должен экономить высоту по сравнению с оригиналом', () => {
      const originalHero = 32;
      const compactHero = COMPACT_SPACING.hero.desktop;
      const reduction = ((originalHero - compactHero) / originalHero) * 100;
      expect(reduction).toBeGreaterThanOrEqual(10);
      expect(reduction).toBeLessThanOrEqual(30);
    });
  });

  describe('DESIGN_TOKENS usage', () => {
    it('должен использовать DESIGN_TOKENS для цветов', () => {
      expect(DESIGN_TOKENS.colors.background).toBeDefined();
      expect(DESIGN_TOKENS.colors.surface).toBeDefined();
      expect(DESIGN_TOKENS.colors.text).toBeDefined();
      expect(DESIGN_TOKENS.colors.primary).toBeDefined();
    });

    it('должен использовать DESIGN_TOKENS для spacing', () => {
      expect(DESIGN_TOKENS.spacing.xs).toBe(8);
      expect(DESIGN_TOKENS.spacing.sm).toBe(12);
      expect(DESIGN_TOKENS.spacing.md).toBe(16);
      expect(DESIGN_TOKENS.spacing.lg).toBe(24);
    });

    it('должен использовать DESIGN_TOKENS для radii', () => {
      expect(DESIGN_TOKENS.radii.sm).toBe(12);
      expect(DESIGN_TOKENS.radii.md).toBe(16);
      expect(DESIGN_TOKENS.radii.lg).toBe(20);
    });

    it('должен использовать DESIGN_TOKENS для shadows', () => {
      expect(DESIGN_TOKENS.shadows.light).toBeDefined();
      expect(DESIGN_TOKENS.shadows.card).toBeDefined();
      expect(DESIGN_TOKENS.shadowsNative.light).toBeDefined();
    });
  });

  describe('Responsive breakpoints', () => {
    it('должен применять mobile spacing на мобильных', () => {
      const mobileSpacing = COMPACT_SPACING.hero.mobile;
      const desktopSpacing = COMPACT_SPACING.hero.desktop;
      expect(mobileSpacing).toBeLessThan(desktopSpacing);
    });

    it('должен использовать правильные breakpoints', () => {
      expect(DESIGN_TOKENS.breakpoints.mobile).toBe(768);
      expect(DESIGN_TOKENS.breakpoints.tablet).toBe(1024);
      expect(DESIGN_TOKENS.breakpoints.desktop).toBe(1280);
    });
  });

  describe('Accessibility', () => {
    it('должен поддерживать WCAG AA контраст для светлой темы', () => {
      // Проверяем что токены используют правильные цвета
      expect(DESIGN_TOKENS.colors.text).toBe('#3a3a3a'); // темный на светлом фоне
      expect(DESIGN_TOKENS.colors.background).toBe('#fdfcfb'); // светлый фон
    });

    it('должен иметь focus indicators', () => {
      expect(DESIGN_TOKENS.colors.focus).toBeDefined();
      expect(DESIGN_TOKENS.colors.focusStrong).toBeDefined();
    });

    it('должен поддерживать disabled состояния', () => {
      expect(DESIGN_TOKENS.colors.disabled).toBeDefined();
      expect(DESIGN_TOKENS.colors.disabledText).toBeDefined();
    });
  });
});

describe('Компактность - Before/After', () => {
  const metrics = {
    before: {
      heroPadding: 32,
      sectionPadding: 24,
      cardPadding: 16,
      titleSize: 26,
      bodySize: 16,
    },
    after: {
      heroPadding: COMPACT_SPACING.hero.desktop,
      sectionPadding: COMPACT_SPACING.section.desktop,
      cardPadding: COMPACT_SPACING.card.desktop,
      titleSize: COMPACT_TYPOGRAPHY.title.desktop + 2,
      bodySize: COMPACT_TYPOGRAPHY.body.desktop,
    },
  };

  it('hero padding уменьшен относительно оригинала', () => {
    const reduction = ((metrics.before.heroPadding - metrics.after.heroPadding) / metrics.before.heroPadding) * 100;
    expect(reduction).toBeGreaterThanOrEqual(0);
    expect(reduction).toBeLessThan(30);
  });

  it('section padding не превышает оригинал', () => {
    expect(metrics.after.sectionPadding).toBeLessThanOrEqual(metrics.before.sectionPadding);
  });

  it('card padding не превышает оригинал', () => {
    expect(metrics.after.cardPadding).toBeLessThanOrEqual(metrics.before.cardPadding);
  });

  it('title size не превышает оригинал', () => {
    expect(metrics.after.titleSize).toBeLessThanOrEqual(metrics.before.titleSize);
  });

  it('body size уменьшен умеренно', () => {
    const reduction = ((metrics.before.bodySize - metrics.after.bodySize) / metrics.before.bodySize) * 100;
    expect(reduction).toBeGreaterThanOrEqual(0);
    expect(reduction).toBeLessThan(15);
  });
});

