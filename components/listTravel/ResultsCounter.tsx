// ResultsCounter.tsx - Компонент для отображения количества результатов поиска
import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;

interface ResultsCounterProps {
  count: number;
  isLoading?: boolean;
  query?: string;
  hasFilters?: boolean;
}

function ResultsCounter({
  count,
  isLoading = false,
  query,
  hasFilters = false,
}: ResultsCounterProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={palette.primary} />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  const formatCount = (num: number): string => {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  const pluralizeTravels = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'путешествие';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return 'путешествия';
    }
    return 'путешествий';
  };

  const getMessage = (): string => {
    if (count === 0) {
      if (query || hasFilters) {
        return 'Ничего не найдено';
      }
      return 'Пока нет путешествий';
    }

    const countText = formatCount(count);
    const travelsText = pluralizeTravels(count);

    if (query) {
      return `Найдено ${countText} ${travelsText} по запросу "${query}"`;
    }

    if (hasFilters) {
      return `Найдено ${countText} ${travelsText}`;
    }

    return `Всего ${countText} ${travelsText}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {getMessage()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: Platform.select({
      default: spacing.md,
      web: 0,
    }),
  },
  text: {
    fontSize: Platform.select({
      default: 13,
      web: 14,
    }),
    fontWeight: Number(DESIGN_TOKENS.typography.weights.medium) as any,
    color: palette.textMuted,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
  loadingText: {
    fontSize: Platform.select({
      default: 13,
      web: 14,
    }),
    fontWeight: Number(DESIGN_TOKENS.typography.weights.regular) as any,
    color: palette.textMuted,
    ...Platform.select({
      web: {
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
      },
    }),
  },
});

export default memo(ResultsCounter);

