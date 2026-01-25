import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { TRAVEL_CARD_MAX_WIDTH } from './utils/listTravelConstants';

// Alias для более короткой записи
const designTokens = DESIGN_TOKENS;

// Создаем отдельные стили для web и native с правильными типами
const webStyles: any = {
  card: {
    // ✅ A5.2: Упрощенная тень для лучшей производительности
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    // ✅ B3.1: Используем transitions вместо animations
    transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
    cursor: "pointer",
    // ✅ B3.1: Уменьшенная интенсивность анимации (-4px вместо -8px)
    ":hover": {
      transform: "translateY(-4px)",
      boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)',
      borderColor: 'var(--color-borderAccent)',
    },
    ":active": {
      transform: "scale(0.98)",
      transition: "all 0.1s ease",
    },
  },
  tag: {
    transition: "all 0.2s ease",
    ":hover": {
      backgroundColor: "var(--color-backgroundSecondary)",
      borderColor: "var(--color-border)",
      transform: "scale(1.05)",
    },
  },
  favoriteButton: {
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    // ✅ A5.2: Упрощенная тень
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
    ":hover": {
      transform: "scale(1.08)",
      backgroundColor: "var(--color-surface)",
      boxShadow: "0 6px 12px rgba(0, 0, 0, 0.15)",
    },
    ":active": {
      transform: "scale(0.95)",
      transition: "all 0.1s ease",
    },
  },
  adminActionsContainer: {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    // ✅ A5.2: Упрощенная тень
    boxShadow: '0 4px 8px rgba(15,23,42,0.1)',
    transition: "transform 0.2s ease-out",
    ":hover": {
      transform: "scale(1.03)",
      backgroundColor: 'var(--color-surface)',
    },
  },
  adminButton: {
    transition: "all 0.2s ease",
    cursor: 'pointer',
    ":hover": {
      backgroundColor: 'var(--color-backgroundSecondary)',
    },
  },
  infoBadge: {
    // ✅ A5.2: Упрощенная тень
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "transform 0.2s ease-out",
    ":hover": {
      transform: "scale(1.03)",
      backgroundColor: "var(--color-surface)",
    },
  },
  title: {
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};

/**
 * Получить адаптивные значения на основе ширины экрана
 * Использует ширину вместо Platform.select для правильной работы в браузере
 * ✅ ОПТИМИЗАЦИЯ: Добавляем мемоизацию для избежания лишних перерасчетов
 */
type ResponsiveCacheKey = 'mobile' | 'desktop';
const responsiveValuesCache = new Map<ResponsiveCacheKey, ReturnType<typeof calculateResponsiveValues>>();

function calculateResponsiveValues(width: number) {
  const isMobile = width < METRICS.breakpoints.tablet;
  return {
    borderRadius: isMobile ? 16 : 20,
    marginBottom: isMobile ? 20 : 24,
    imagePadding: isMobile ? 12 : 24,
    imagePaddingTop: isMobile ? 10 : 21,
    imageGap: isMobile ? 8 : 15,
    titleFontSize: isMobile ? 16 : 20,
    titleLineHeight: isMobile ? 22 : 28,
    titleMarginBottom: isMobile ? 2 : 6,
    titleMinHeight: isMobile ? 44 : 56,
    metaFontSize: isMobile ? 12 : 14,
    metaLineHeight: isMobile ? 16 : 20,
    tagFontSize: isMobile ? 11 : 13,
    tagLineHeight: isMobile ? 15 : 18,
  };
}

export function getResponsiveCardValues(width: number) {
  // ✅ ОПТИМИЗАЦИЯ: Используем кэширование для избежания перерасчетов
  const cacheKey: ResponsiveCacheKey = width < METRICS.breakpoints.tablet ? 'mobile' : 'desktop';
  if (responsiveValuesCache.has(cacheKey)) {
    return responsiveValuesCache.get(cacheKey)!;
  }

  const values = calculateResponsiveValues(width);
  responsiveValuesCache.set(cacheKey, values);
  return values;
}

// Карточка всегда занимает всю ширину доступной ячейки, но имеет максимальную ширину
const getCardWidth = () => '100%';

export const enhancedTravelCardStyles = StyleSheet.create({
  // Основная карточка с улучшенной тенью и анимацией
  card: {
    width: getCardWidth() as any,
    maxWidth: TRAVEL_CARD_MAX_WIDTH,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: DESIGN_TOKENS.colors.background,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    overflow: "hidden",
    flexDirection: 'column',
    // Карточка растягивается на всю ячейку, но не выходит за пределы maxWidth
    alignSelf: 'stretch',
    flexShrink: 1,
    // ✅ ВАЖНО: marginBottom удален, отступы создаются через ItemSeparatorComponent в FlatList
    // Это предотвращает конфликты с gap в columnWrapperStyle и дает явный контроль над отступами
    ...Platform.select({
      ios: {
        shadowColor: designTokens.colors.text, // Используем design token
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        ...webStyles.card,
        boxSizing: 'border-box' as any,
        flexShrink: 0, // ✅ Для web тоже отключаем сжатие
      },
    }),
  },

  // Улучшенный контейнер изображения с градиентом
  imageContainer: {
    position: "relative",
    width: "100%",
    // ✅ Фиксированная высота 220px для всех платформ для предсказуемости
    // В браузере Platform всегда = 'web', поэтому aspectRatio делал изображения большими
    height: 220,
    backgroundColor: designTokens.colors.surfaceMuted, // Используем design token
    overflow: "hidden",
    flexShrink: 0,
    ...Platform.select({
      web: {
        contain: 'layout style paint' as any,
      },
    }),
  },

  // Более плавный градиент
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    ...Platform.select({
      web: {
        // React Native Web не поддерживает сокращённое свойство background
        // Используем backgroundImage, чтобы избежать warning Invalid style property "background"
        backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        // ✅ A5.2: Добавляем will-change для оптимизации
        willChange: 'opacity' as any,
      } as any,
      default: {
        // Для React Native используем LinearGradient компонент
        backgroundColor: 'transparent',
      }
    }),
  },

  // Улучшенный контент под изображением
  contentContainer: {
    // ✅ Мобильные значения по умолчанию для правильной работы в браузере
    padding: DESIGN_TOKENS.spacing.sm,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: DESIGN_TOKENS.colors.background,
    // flex: 1, // УБРАНО: убираем растягивание контента
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
      },
    }),
  },

  // ✅ B2.1: Улучшенная типографика с адаптивными размерами
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: DESIGN_TOKENS.typography.weights.bold,
    fontFamily: Platform.select({ web: DESIGN_TOKENS.typography.fontFamily, default: undefined }),
    color: DESIGN_TOKENS.colors.text,
    lineHeight: DESIGN_TOKENS.typography.sizes.md * 1.5,
    letterSpacing: -0.025,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
    minHeight: 44, // Мобильное значение
    ...Platform.select({
      web: {
        ...webStyles.title,
        // ✅ B2.1: CSS clamp для fluid typography — делаем шрифт чуть меньше
        fontSize: 'clamp(16px, 1.6vw, 20px)' as any,
      },
    }),
  },

  // Улучшенные теги с лучшей визуальной иерархией
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: designTokens.spacing.xxs, // Используем design token
    marginBottom: designTokens.spacing.xs, // Используем design token
  },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: designTokens.colors.surfaceMuted, // Используем design token
    borderRadius: designTokens.radii.sm, // Используем design token
    paddingHorizontal: designTokens.spacing.xs, // Используем design token
    paddingVertical: designTokens.spacing.xxs, // Используем design token
    borderWidth: 1,
    borderColor: designTokens.colors.borderLight, // Используем design token
    ...Platform.select({
      web: webStyles.tag,
    }),
  },

  tagText: {
    fontSize: designTokens.typography.sizes.sm, // Используем design token
    color: designTokens.colors.textMuted, // Используем design token
    fontWeight: designTokens.typography.weights.semibold as any, // Используем design token
    letterSpacing: 0, // Normal letter spacing
    // ✅ B2.1: Улучшенный line-height
    lineHeight: 15, // Мобильное значение
  },

  // Улучшенный мета-информационный блок
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    paddingTop: designTokens.spacing.sm, // Используем design token
    borderTopWidth: 1,
    borderTopColor: designTokens.colors.borderLight, // Используем design token
    marginTop: 'auto',
  },

  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.sm }) as any, // Используем design tokens
    flex: 1,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.xxs, // Используем design token
  },

  metaText: {
    // ✅ B2.1: Адаптивный размер для мета-информации
    fontSize: designTokens.typography.sizes.sm, // Используем design token
    color: designTokens.colors.textMuted, // Используем design token
    fontWeight: designTokens.typography.weights.medium as any, // Используем design token
    letterSpacing: 0, // Normal letter spacing
    // ✅ B2.1: Улучшенный line-height
    lineHeight: 20, // Normal line height
    ...Platform.select({
      web: {
        fontSize: 'clamp(13px, 1.4vw, 16px)' as any, // Было 11-13px
      },
    }),
  },

  // Улучшенные бейджи статуса
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: designTokens.spacing.xxs, web: designTokens.spacing.xxs }) as any, // Используем design token
    paddingHorizontal: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    paddingVertical: Platform.select({ default: designTokens.spacing.xxs, web: designTokens.spacing.xxs }) as any, // Используем design token
    borderRadius: designTokens.radii.full, // Используем design token
    backgroundColor: designTokens.colors.surfaceMuted, // Используем design token
    borderWidth: 1,
    borderColor: designTokens.colors.borderLight, // Используем design token
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
      },
    }),
  },

  statusBadgeText: {
    fontSize: Platform.select({ default: designTokens.typography.sizes.sm, web: designTokens.typography.sizes.sm }) as any, // Используем design token
    fontWeight: designTokens.typography.weights.semibold as any, // Используем design token
    color: designTokens.colors.text, // Используем design token
    letterSpacing: 0, // Normal letter spacing
  },

  // Популярный статус с улучшенными цветами
  popularBadge: {
    backgroundColor: designTokens.colors.primarySoft, // Используем доступный оттенок token
    borderColor: designTokens.colors.primaryLight, // Используем доступный оттенок token
  },
  popularBadgeText: {
    color: designTokens.colors.primaryDark, // Используем design token
  },

  // Новый статус с улучшенными цветами
  newBadge: {
    backgroundColor: designTokens.colors.accentSoft, // Используем design token
    borderColor: designTokens.colors.accentLight, // Используем design token
  },
  newBadgeText: {
    color: designTokens.colors.accent, // Используем design token
  },

  topBadges: {
    position: "absolute",
    bottom: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    left: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    right: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.select({ default: designTokens.spacing.xxs, web: designTokens.spacing.xxs }) as any, // Используем design token
    zIndex: designTokens.zIndex.dropdown, // Используем design token
  },

  // ✅ B7.1: Улучшенная кнопка избранного - touch-friendly размер
  favoriteButton: {
    position: "absolute",
    top: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    right: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    zIndex: designTokens.zIndex.modal, // Используем design token
    // ✅ B7.1: Минимум 44x44px для touch targets
    width: Platform.select({ default: 44, web: 40 }),
    height: Platform.select({ default: 44, web: 40 }),
    borderRadius: Platform.select({ default: designTokens.radii.full, web: designTokens.radii.lg }) as any, // Используем design token
    backgroundColor: designTokens.colors.surfaceElevated, // Используем design token
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: designTokens.colors.text, // Используем design token
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: webStyles.favoriteButton,
    }),
  },

  // ✅ B7.1: Улучшенные кнопки администратора - touch-friendly
  adminActionsContainer: {
    position: 'absolute',
    top: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    left: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    zIndex: designTokens.zIndex.modal, // Используем design token
    flexDirection: 'row',
    alignItems: 'center',
    // ✅ B7.1: Увеличенный padding для touch targets
    paddingHorizontal: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    paddingVertical: Platform.select({ default: designTokens.spacing.xxs, web: designTokens.spacing.xxs }) as any, // Используем design token
    borderRadius: designTokens.radii.full, // Используем design token
    backgroundColor: designTokens.colors.surfaceElevated, // Используем design token
    ...Platform.select({
      ios: {
        shadowColor: designTokens.colors.text, // Используем design token
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: webStyles.adminActionsContainer,
    }),
  },

  adminButton: {
    // ✅ B7.1: Минимум 44x44px touch target
    paddingHorizontal: Platform.select({ default: designTokens.spacing.sm, web: designTokens.spacing.xs }) as any, // Используем design token
    paddingVertical: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xxs }) as any, // Используем design token
    minWidth: Platform.select({ default: 44, web: undefined }),
    minHeight: Platform.select({ default: 44, web: undefined }),
    borderRadius: designTokens.radii.full, // Используем design token
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: webStyles.adminButton,
    }),
  },

  // Улучшенные информационные бейджи на изображении
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.select({ default: designTokens.spacing.xxs, web: designTokens.spacing.xxs }) as any, // Используем design token
    backgroundColor: designTokens.colors.surfaceElevated, // Используем design token
    borderRadius: designTokens.radii.full, // Используем design token
    paddingHorizontal: Platform.select({ default: designTokens.spacing.xs, web: designTokens.spacing.xs }) as any, // Используем design token
    paddingVertical: Platform.select({ default: designTokens.spacing.xxs, web: designTokens.spacing.xxs }) as any, // Используем design token
    borderWidth: 1,
    borderColor: designTokens.colors.border, // Используем design token
    margin: Platform.select({ default: designTokens.spacing.xxs, web: 0 }) as any, // Используем design token
    ...Platform.select({
      ios: {
        shadowColor: designTokens.colors.text, // Используем design token
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: webStyles.infoBadge,
    }),
  },

  infoBadgeText: {
    fontSize: Platform.select({ default: designTokens.typography.sizes.sm, web: designTokens.typography.sizes.sm }) as any, // Используем design token
    color: designTokens.colors.text, // Используем design token
    fontWeight: designTokens.typography.weights.bold as any, // Используем design token
    letterSpacing: -0.02, // Tight letter spacing
  },

  // Адаптивные стили для разных размеров экрана
  compactCard: {
    ...Platform.select({
      web: {
        // hover стили будут добавлены через CSS классы
      } as any,
    }),
  },

  // Анимация загрузки
  loadingPlaceholder: {
    backgroundColor: designTokens.colors.surfaceMuted, // Используем design token
    borderRadius: designTokens.radii.sm, // Используем design token
    ...Platform.select({
      web: {
        // animation будет добавлен через CSS классы
      },
    }),
  },
});

// Экспортируем web-стили для использования в компонентах
export const webSpecificStyles = webStyles;

// Web-стили для анимаций (только на клиенте)
const addWebAnimations = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .travel-card-enter {
        animation: slideIn 0.5s ease-out;
      }
      
      .loading-placeholder {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      
      /* ✅ B3.1: Media queries для hover-capable устройств */
      /* Hover эффекты только для устройств с точным указателем (мышь) */
      @media (hover: hover) and (pointer: fine) {
        .travel-card {
          transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
        }
        
        .travel-card:hover {
          transform: translateY(-4px);
        }
        
        /* Добавляем will-change только при hover для экономии ресурсов */
        .travel-card:hover {
          will-change: transform, box-shadow;
        }
      }
      
      /* ✅ B3.1: Touch feedback для сенсорных устройств */
      @media (hover: none) {
        .travel-card:active {
          transform: scale(0.98);
          opacity: 0.9;
          transition: all 0.1s ease;
        }
      }
      
      /* ✅ A5.2: CSS containment для оптимизации */
      .travel-card {
        contain: layout style paint;
      }
      
      /* Focus indicators для доступности */
      .travel-card:focus-visible {
        outline: 2px solid ${designTokens.colors.primary};
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }
};

// Вызываем только на клиенте
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') {
    addWebAnimations();
  } else {
    // Для SSR откладываем до монтирования
    setTimeout(addWebAnimations, 0);
  }
}
