// Компонент для пустых состояний
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS, AIRY_GRADIENTS, AIRY_BOX_SHADOWS } from '@/constants/airyColors';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  iconSize?: number;
  iconColor?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  iconSize = 96, // ✅ ДИЗАЙН: Увеличен размер иконки
  iconColor = AIRY_COLORS.primary, // ✅ ДИЗАЙН: Воздушный легкий персик по умолчанию
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Feather name={icon as any} size={iconSize} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <Pressable
          style={styles.actionButton}
          onPress={action.onPress}
          {...Platform.select({
            web: { 
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              // @ts-ignore
              ':hover': {
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: '0 4px 12px rgba(255, 159, 90, 0.3)',
              },
            },
          })}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.select({
      default: 32, // Mobile: 32px
      web: 48, // Desktop: 48px
    }),
    minHeight: Platform.select({
      default: 300, // Mobile: 300px
      web: 400, // Desktop: 400px
    }),
  },
  iconContainer: {
    width: 120, // ✅ ДИЗАЙН: Контейнер для иконки
    height: 120,
    borderRadius: 60,
    backgroundColor: AIRY_COLORS.primaryLight, // ✅ ДИЗАЙН: Воздушный легкий персиковый фон
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(255, 159, 90, 0.15)',
      },
    }),
  },
  title: {
    fontSize: Platform.select({
      default: 22, // Mobile: 22px
      web: 24, // Desktop: 24px
    }),
    fontWeight: '700',
    fontFamily: Platform.select({ web: 'Georgia, serif', default: undefined }), // ✅ ДИЗАЙН: Georgia для заголовков
    color: '#1a202c', // ✅ ДИЗАЙН: Единый цвет
    marginTop: 8, // ✅ ДИЗАЙН: Уменьшен отступ
    marginBottom: 12, // ✅ ДИЗАЙН: Увеличен отступ
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: Platform.select({
      default: 15, // Mobile: 15px
      web: 16, // Desktop: 16px
    }),
    color: '#4a5568', // ✅ ДИЗАЙН: Вторичный цвет
    textAlign: 'center',
    lineHeight: Platform.select({
      default: 22, // Mobile: 22px
      web: 24, // Desktop: 24px
    }),
    marginBottom: 32, // ✅ ДИЗАЙН: Увеличен отступ
    maxWidth: Platform.select({
      default: 320, // Mobile: 320px
      web: 400, // Desktop: 400px
    }),
  },
  actionButton: {
    paddingHorizontal: 32, // ✅ ДИЗАЙН: Увеличены отступы
    paddingVertical: 14, // ✅ ДИЗАЙН: Высота 48px (14*2 + 20px текста)
    backgroundColor: AIRY_COLORS.primary, // ✅ ДИЗАЙН: Воздушный легкий персиковый фон
    borderRadius: 12, // ✅ ДИЗАЙН: Увеличен радиус
    ...Platform.select({
      web: {
        backgroundColor: 'transparent', // ✅ ИСПРАВЛЕНИЕ: Используем backgroundColor вместо background
        backgroundImage: AIRY_GRADIENTS.primary as any, // ✅ ДИЗАЙН: Воздушный легкий градиент
        boxShadow: AIRY_BOX_SHADOWS.medium,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        // @ts-ignore
        ':hover': {
          transform: 'translateY(-2px) scale(1.02)',
          boxShadow: '0 4px 12px rgba(255, 159, 90, 0.3)',
        },
      },
    }),
  },
  actionText: {
    color: '#fff',
    fontSize: 16, // ✅ ДИЗАЙН: Увеличен размер
    fontWeight: '700', // ✅ ДИЗАЙН: Увеличен weight
    letterSpacing: 0.3,
  },
});

