import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Создаем отдельные стили для web и native с правильными типами
const webStyles: any = {
  card: {
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    ":hover": {
      transform: "translateY(-8px) scale(1.02)",
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    ":active": {
      transform: "translateY(-2px) scale(1.01)",
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
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    ":hover": {
      transform: "scale(1.1)",
      backgroundColor: "#ffffff",
      boxShadow: "0 8px 12px -1px rgba(0, 0, 0, 0.15), 0 4px 8px -1px rgba(0, 0, 0, 0.1)",
    },
    ":active": {
      transform: "scale(0.95)",
      transition: "all 0.1s ease",
    },
  },
  adminActionsContainer: {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 4px 6px -1px rgba(15,23,42,0.1), 0 2px 4px -1px rgba(15,23,42,0.06)',
    transition: "all 0.2s ease",
    ":hover": {
      transform: "scale(1.05)",
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
    boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "all 0.2s ease",
    ":hover": {
      transform: "scale(1.05)",
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

export const enhancedTravelCardStyles = StyleSheet.create({
  // Основная карточка с улучшенной тенью и анимацией
  card: {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    borderRadius: Platform.select({ default: 20, web: 24 }),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: "hidden",
    flexDirection: 'column',
    alignSelf: 'stretch',
    // ✅ FIX: Добавлен marginBottom для создания отступа между карточками
    marginBottom: Platform.select({ default: 16, web: 20 }),
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
    // ✅ ИСПРАВЛЕНИЕ: Фиксированная высота для всех платформ для предотвращения обрезки
    height: Platform.select({ default: 200, web: 240 }),
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    overflow: "hidden",
    flexShrink: 0,
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
      } as any,
      default: {
        // Для React Native используем LinearGradient компонент
        backgroundColor: 'transparent',
      }
    }),
  },

  // Улучшенный контент под изображением
  contentContainer: {
    padding: Platform.select({ default: 14, web: 20 }), // Уменьшен padding для мобильных
    paddingTop: Platform.select({ default: 12, web: 16 }),
    gap: Platform.select({ default: 8, web: 12 }),
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
      },
    }),
  },

  // Улучшенный заголовок с лучшей типографикой
  title: {
    fontSize: Platform.select({ default: 16, web: 18 }), // Уменьшен размер для мобильных
    fontWeight: '700',
    fontFamily: Platform.select({ web: DESIGN_TOKENS.typography.fontFamily, default: undefined }),
    color: "#0f172a",
    lineHeight: Platform.select({ default: 22, web: 26 }),
    letterSpacing: -0.4,
    marginBottom: Platform.select({ default: 2, web: 4 }),
    minHeight: Platform.select({ default: 44, web: 52 }), // Для 2 строк
    ...Platform.select({
      web: webStyles.title,
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
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
    letterSpacing: 0.2,
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
    gap: 16,
    flex: 1,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  metaText: {
    fontSize: Platform.select({ default: 12, web: 13 }),
    color: "#64748b",
    fontWeight: "500",
    letterSpacing: 0.1,
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

  // Улучшенная кнопка избранного
  favoriteButton: {
    position: "absolute",
    top: Platform.select({ default: 10, web: 12 }),
    right: Platform.select({ default: 10, web: 12 }),
    zIndex: 20,
    width: Platform.select({ default: 38, web: 44 }),
    height: Platform.select({ default: 38, web: 44 }),
    borderRadius: Platform.select({ default: 19, web: 22 }),
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

  // Улучшенные кнопки администратора
  adminActionsContainer: {
    position: 'absolute',
    top: Platform.select({ default: 10, web: 12 }),
    left: Platform.select({ default: 10, web: 12 }),
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Platform.select({ default: 10, web: 12 }),
    paddingVertical: Platform.select({ default: 5, web: 6 }),
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
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    gap: Platform.select({ default: 4, web: 6 }),
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 999,
    paddingHorizontal: Platform.select({ default: 10, web: 12 }),
    paddingVertical: Platform.select({ default: 5, web: 6 }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
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
