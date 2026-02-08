// ModernSearchBar.tsx - Современная панель поиска
import React, { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { BlurView } from 'expo-blur';
import { useThemedColors } from '@/hooks/useTheme';

const { spacing, radii, typography, animations, colors: tokenColors } = DESIGN_TOKENS;

interface ModernSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  showFiltersButton?: boolean;
  onToggleFilters?: () => void;
  showRecommendations?: boolean;
  onToggleRecommendations?: () => void;
  resultsCount?: number;
  isLoading?: boolean;
}

const ModernSearchBar: React.FC<ModernSearchBarProps> = memo(({
  value,
  onChangeText,
  placeholder = "Куда отправимся?",
  onFocus,
  onBlur,
  showFiltersButton = false,
  onToggleFilters,
  showRecommendations = false,
  onToggleRecommendations,
  resultsCount,
  isLoading = false,
}) => {
  const themedColors = useThemedColors();
  const styles = useMemo(() => createStyles(themedColors), [themedColors]);
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const shouldUseNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    
    Animated.parallel([
      Animated.spring(animatedScale, {
        toValue: 1.02,
        useNativeDriver: shouldUseNativeDriver,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: animations.duration.fast,
        useNativeDriver: shouldUseNativeDriver,
      }),
    ]).start();
  }, [onFocus, animatedScale, animatedOpacity, shouldUseNativeDriver]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
    
    Animated.parallel([
      Animated.spring(animatedScale, {
        toValue: 1,
        useNativeDriver: shouldUseNativeDriver,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 0,
        duration: animations.duration.fast,
        useNativeDriver: shouldUseNativeDriver,
      }),
    ]).start();
  }, [onBlur, animatedScale, animatedOpacity, shouldUseNativeDriver]);

  const handleChangeText = useCallback((text: string) => {
    setLocalValue(text);
    onChangeText(text);
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const SearchIcon = () => (
    <View style={styles.searchIcon}>
      <Feather name="search" size={20} color={themedColors.textMuted} />
    </View>
  );

  const ClearButton = () => (
    localValue.length > 0 ? (
      <Pressable onPress={handleClear} style={styles.clearButton}>
        <Feather name="x-circle" size={18} color={themedColors.textMuted} />
      </Pressable>
    ) : null
  );

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.searchWrapper,
          {
            transform: [{ scale: animatedScale }],
          }
        ]}
      >
        {/* Blur Background for iOS */}
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={95}
            tint="light"
            style={StyleSheet.absoluteFillObject}
          />
        )}
        
        {/* Main Search Bar */}
        <View style={[
          styles.searchBar,
          isFocused && styles.searchBarFocused,
        ]}>
          {/* Filter Button (Mobile) */}
          {showFiltersButton && (
            <Pressable 
              onPress={onToggleFilters}
              style={styles.filterButton}
            >
              <Feather name="sliders" size={18} color={themedColors.text} />
            </Pressable>
          )}

          <SearchIcon />
          
          <TextInput
            ref={inputRef}
            value={localValue}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={themedColors.textMuted}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            {...Platform.select({
              web: {
                // @ts-ignore
                'aria-label': 'Поиск путешествий',
                spellCheck: false,
              },
            })}
          />

          <ClearButton />

          {/* Recommendations Toggle */}
          {onToggleRecommendations && (
            <Pressable
              onPress={onToggleRecommendations}
              style={[
                styles.recommendButton,
                showRecommendations && styles.recommendButtonActive,
              ]}
            >
              <Feather
                name="zap"
                size={18}
                color={showRecommendations ? themedColors.accent : themedColors.textMuted}
              />
            </Pressable>
          )}
        </View>

        {/* Focus Overlay */}
        <Animated.View
          style={[
            styles.focusOverlay,
            {
              opacity: animatedOpacity,
            },
            { pointerEvents: 'none' } as any,
          ]}
        />
      </Animated.View>

      {/* Results Count */}
      {resultsCount !== undefined && (
        <View style={styles.resultsContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Поиск...</Text>
            </View>
          ) : (
            <View style={styles.resultsBadge}>
              <Text style={styles.resultsText}>
                {resultsCount} {getResultsWord(resultsCount)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const getResultsWord = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'результат';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'результата';
  return 'результатов';
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  searchWrapper: {
    position: 'relative',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 56,
    borderWidth: 2,
    borderColor: tokenColors.transparent,
    ...Platform.select({
      ios: {
        backgroundColor: colors.surfaceMuted,
      },
      web: {
        transition: `all ${animations.duration.normal}ms ${animations.easing.default}`,
      },
    }),
  },
  searchBarFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.focusStrong,
    ...colors.shadows.medium,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 4px ${colors.primarySoft}, ${colors.boxShadows.medium}`,
      },
    }),
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    ...colors.shadows.light,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium as any,
    color: colors.text,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0 as any,
        backgroundColor: tokenColors.transparent,
      },
    }),
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  recommendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    ...colors.shadows.light,
    ...Platform.select({
      web: {
        transition: `all ${animations.duration.fast}ms ${animations.easing.default}`,
        cursor: 'pointer',
      },
    }),
  },
  recommendButtonActive: {
    backgroundColor: colors.accentSoft,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 2px ${colors.accent}`,
      },
    }),
  },
  focusOverlay: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radii.pill + 4,
    borderWidth: 2,
    borderColor: colors.focus,
    pointerEvents: 'none',
  },
  resultsContainer: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  resultsBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  resultsText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium as any,
    color: colors.primaryDark,
  },
});

export default memo(ModernSearchBar);
