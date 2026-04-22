/**
 * MapSearchInput - поисковое поле для фильтрации мест на карте по названию
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface MapSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  resultsCount?: number;
  testID?: string;
}

const MapSearchInput: React.FC<MapSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Поиск мест...',
  onClear,
  resultsCount,
  testID = 'map-search-input',
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChange('');
    onClear?.();
  }, [onChange, onClear]);

  const showClear = value.length > 0;
  const showResultsHint = typeof resultsCount === 'number' && value.length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
        <Feather name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          testID={testID}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          inputMode="search"
          accessibilityLabel="Поиск мест на карте"
          accessibilityHint="Введите название места для поиска"
        />
        {showClear && (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Очистить поиск"
            hitSlop={8}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {showResultsHint && (
        <Text style={styles.resultsHint}>
          {resultsCount === 0
            ? 'Ничего не найдено, попробуйте другой запрос'
            : `На карте подходит: ${resultsCount}`}
        </Text>
      )}
    </View>
  );
};

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 12,
      minHeight: 44,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
          } as any)
        : null),
    },
    inputWrapperFocused: {
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: `0 0 0 3px ${colors.primaryLight}` } as any)
        : null),
    },
    searchIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      // Native keeps the compact 13px; on web we need 16px to avoid iOS
      // Safari's auto-zoom on input focus, which breaks the map viewport.
      fontSize: Platform.OS === 'web' ? 16 : 13,
      color: colors.text,
      fontWeight: '500',
      paddingVertical: 7,
      ...(Platform.OS === 'web'
        ? ({
          outlineWidth: 0,
          outlineStyle: 'none',
          outlineColor: 'transparent',
        } as any)
        : null),
    },
    clearButton: {
      padding: 4,
      marginLeft: 4,
    },
    resultsHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
      marginLeft: 4,
    },
  });

export default React.memo(MapSearchInput);
