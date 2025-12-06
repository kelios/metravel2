// ModernSearchBar.tsx - Современная панель поиска
import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { MODERN_DESIGN_TOKENS } from '@/styles/modernRedesign';
import { BlurView } from 'expo-blur';

const { colors, spacing, radii, typography, shadows, animations, boxShadows } = MODERN_DESIGN_TOKENS;

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
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
    
    Animated.parallel([
      Animated.spring(animatedScale, {
        toValue: 1.02,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onFocus, animatedScale, animatedOpacity]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
    
    Animated.parallel([
      Animated.spring(animatedScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(animatedOpacity, {
        toValue: 0,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onBlur, animatedScale, animatedOpacity]);

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
      <Feather name="search" size={20} color={colors.neutral[400]} />
    </View>
  );

  const ClearButton = () => (
    localValue.length > 0 ? (
      <Pressable onPress={handleClear} style={styles.clearButton}>
        <Feather name="x-circle" size={18} color={colors.neutral[400]} />
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
              <Feather name="sliders" size={18} color={colors.neutral[600]} />
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
            placeholderTextColor={colors.neutral[400]}
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
              <MaterialIcons 
                name="auto-awesome" 
                size={18} 
                color={showRecommendations ? colors.accent.amber : colors.neutral[400]} 
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
            }
          ]}
          pointerEvents="none"
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

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  searchWrapper: {
    position: 'relative',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 56,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Platform.select({
      ios: {
        backgroundColor: 'rgba(248, 250, 252, 0.8)',
      },
      web: {
        transition: `all ${animations.duration.base}ms ${animations.easing.ease}`,
      },
    }),
  },
  searchBarFocused: {
    backgroundColor: colors.surface.default,
    borderColor: colors.primary[500],
    ...shadows.md,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 4px ${colors.primary[100]}, ${boxShadows.md}`,
      },
    }),
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[800],
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0,
        backgroundColor: 'transparent',
      },
    }),
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  recommendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    ...shadows.sm,
    ...Platform.select({
      web: {
        transition: `all ${animations.duration.fast}ms ${animations.easing.ease}`,
        cursor: 'pointer',
      },
    }),
  },
  recommendButtonActive: {
    backgroundColor: colors.accent.amber + '20',
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 2px ${colors.accent.amber}40`,
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
    borderColor: colors.primary[200],
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
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    fontStyle: 'italic',
  },
  resultsBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  resultsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
});

export default ModernSearchBar;
