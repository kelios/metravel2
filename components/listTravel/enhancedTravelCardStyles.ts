import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
      borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    ":active": {
      transform: "scale(0.98)",
      transition: "all 0.1s ease",
    },
  },
  tag: {
    transition: "all 0.2s ease",
    ":hover": {
      backgroundColor: "#f1f5f9",
      borderColor: "#cbd5e1",
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
      backgroundColor: "#ffffff",
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
      backgroundColor: '#ffffff',
    },
  },
  adminButton: {
    transition: "all 0.2s ease",
    cursor: 'pointer',
    ":hover": {
      backgroundColor: 'rgba(0,0,0,0.05)',
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
      backgroundColor: "#ffffff",
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
 */
export function getResponsiveCardValues(width: number) {
  const isMobile = width < 768;
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

export const enhancedTravelCardStyles = StyleSheet.create({
  // Основная карточка с улучшенной тенью и анимацией
  card: {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    borderRadius: 16, // Мобильное значение по умолчанию (в браузере Platform = 'web')
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: "hidden",
    flexDirection: 'column',
    alignSelf: 'stretch',
    // ✅ ВАЖНО: marginBottom удален, отступы создаются через ItemSeparatorComponent в FlatList
    // Это предотвращает конфликты с gap в columnWrapperStyle и дает явный контроль над отступами
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        ...webStyles.card,
        boxSizing: 'border-box' as any,
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
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
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
    padding: 12, // Мобильное значение (в браузере Platform = 'web')
    paddingTop: 10,
    gap: 8,
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
      },
    }),
  },

  // ✅ B2.1: Улучшенная типографика с адаптивными размерами
  title: {
    fontSize: 16, // Мобильное значение по умолчанию
    fontWeight: '700',
    fontFamily: Platform.select({ web: DESIGN_TOKENS.typography.fontFamily, default: undefined }),
    color: "#0f172a",
    // ✅ B2.1: Улучшенный line-height для читаемости (1.4x)
    lineHeight: 22, // Мобильное значение
    letterSpacing: -0.4,
    marginBottom: 2,
    minHeight: 44, // Мобильное значение
    ...Platform.select({
      web: {
        ...webStyles.title,
        // ✅ B2.1: CSS clamp для fluid typography (увеличено)
        fontSize: 'clamp(18px, 2vw, 22px)' as any, // Было 15-18px
      },
    }),
  },

  // Улучшенные теги с лучшей визуальной иерархией
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    ...Platform.select({
      web: webStyles.tag,
    }),
  },

  tagText: {
    fontSize: 11, // Мобильное значение по умолчанию
    color: "#475569",
    fontWeight: "600",
    letterSpacing: 0.2,
    // ✅ B2.1: Улучшенный line-height
    lineHeight: 15, // Мобильное значение
  },

  // Улучшенный мета-информационный блок
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 'auto',
  },

  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: 10, web: 14 }), // Уменьшен отступ для мобильных
    flex: 1,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  metaText: {
    // ✅ B2.1: Адаптивный размер для мета-информации
    fontSize: 12, // Мобильное значение по умолчанию
    color: "#64748b",
    fontWeight: "500",
    letterSpacing: 0.1,
    // ✅ B2.1: Улучшенный line-height
    lineHeight: 16, // Мобильное значение
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
    gap: Platform.select({ default: 3, web: 4 }),
    paddingHorizontal: Platform.select({ default: 8, web: 10 }),
    paddingVertical: Platform.select({ default: 3, web: 4 }),
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: {
        transition: "all 0.2s ease",
      },
    }),
  },

  statusBadgeText: {
    fontSize: Platform.select({ default: 10, web: 11 }),
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.2,
  },

  // Популярный статус с улучшенными цветами
  popularBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  popularBadgeText: {
    color: '#2563eb',
  },

  // Новый статус с улучшенными цветами
  newBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  newBadgeText: {
    color: '#d97706',
  },

  topBadges: {
    position: "absolute",
    bottom: Platform.select({ default: 8, web: 10 }),
    left: Platform.select({ default: 8, web: 10 }),
    right: Platform.select({ default: 8, web: 10 }),
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.select({ default: 4, web: 6 }),
    zIndex: 10,
  },

  // ✅ B7.1: Улучшенная кнопка избранного - touch-friendly размер
  favoriteButton: {
    position: "absolute",
    top: Platform.select({ default: 8, web: 10 }),
    right: Platform.select({ default: 8, web: 10 }),
    zIndex: 20,
    // ✅ B7.1: Минимум 44x44px для touch targets
    width: Platform.select({ default: 44, web: 40 }),
    height: Platform.select({ default: 44, web: 40 }),
    borderRadius: Platform.select({ default: 22, web: 20 }),
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    top: Platform.select({ default: 8, web: 10 }),
    left: Platform.select({ default: 8, web: 10 }),
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    // ✅ B7.1: Увеличенный padding для touch targets
    paddingHorizontal: Platform.select({ default: 10, web: 10 }),
    paddingVertical: Platform.select({ default: 6, web: 5 }),
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    paddingHorizontal: Platform.select({ default: 12, web: 8 }),
    paddingVertical: Platform.select({ default: 10, web: 4 }),
    minWidth: Platform.select({ default: 44, web: undefined }),
    minHeight: Platform.select({ default: 44, web: undefined }),
    borderRadius: 999,
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
    gap: Platform.select({ default: 3, web: 5 }),
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 999,
    paddingHorizontal: Platform.select({ default: 8, web: 10 }),
    paddingVertical: Platform.select({ default: 4, web: 5 }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    margin: Platform.select({ default: 2, web: 0 }), // Небольшой отступ от края для мобильных
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontSize: Platform.select({ default: 11, web: 12 }),
    color: "#0f172a",
    fontWeight: "600",
    letterSpacing: -0.1,
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
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
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
        outline: 2px solid #3b82f6;
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
