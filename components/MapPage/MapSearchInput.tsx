/**
 * MapSearchInput - поисковое поле для фильтрации мест на карте по названию
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  InteractionManager,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useMapPanelStore } from '@/stores/mapPanelStore';

// On native the input lives inside a @gorhom bottom sheet: BottomSheetTextInput
// makes the sheet rise above the keyboard on focus (keyboard-avoidance). The web
// sheet is a separate DOM impl (and @gorhom must not initialise on web), so we
// resolve the variant lazily off-web and fall back to the plain RN TextInput if
// the module/export isn't available (e.g. the jest native renderer).
const resolveFocusableInput = (): typeof TextInput => {
  if (Platform.OS === 'web') return TextInput;
  try {
    const mod = require('@gorhom/bottom-sheet');
    return (mod?.BottomSheetTextInput as typeof TextInput) ?? TextInput;
  } catch {
    return TextInput;
  }
};

const FocusableInput: typeof TextInput = resolveFocusableInput();

// Retry cadence after interactions settle: a couple of fast frames then a longer
// backstop, covering the window where the BottomSheetTextInput mounts/settles
// slightly after the sheet open animation ends.
const RETRY_DELAYS = [120, 250, 400] as const;

interface MapSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  resultsCount?: number;
  testID?: string;
  /**
   * When true, the input grabs focus whenever the shared search-focus signal is
   * bumped (user tapped the "Искать места" row). Only the place-name search wires
   * this; other inputs leave it off.
   */
  autoFocusOnSignal?: boolean;
}

const MapSearchInput: React.FC<MapSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Поиск мест...',
  onClear,
  resultsCount,
  testID = 'map-search-input',
  autoFocusOnSignal = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const searchFocusNonce = useMapPanelStore((s) => s.searchFocusNonce);
  const pendingSearchFocus = useMapPanelStore((s) => s.pendingSearchFocus);
  const consumeSearchFocus = useMapPanelStore((s) => s.consumeSearchFocus);

  // Shared focus routine: wait for interactions/animations to settle
  // (runAfterInteractions defers past the bottom-sheet open/snap animation),
  // then retry focus a few times across frames until the ref resolves and the
  // platform accepts focus. Each retry is cheap and stops as soon as the input
  // reports focused; on success we clear the latched store intent.
  //
  // Why the previous single 350ms timeout failed on-device: on native the input
  // is a @gorhom BottomSheetTextInput that only becomes focusable once (a) the
  // sheet open/snap animation finishes and (b) the input is actually mounted in
  // the visible snap. A fixed delay races both, so the keyboard never showed
  // (mInputShown=false).
  const runFocus = useCallback(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tryFocus = (attempt: number) => {
      if (cancelled) return;
      inputRef.current?.focus();
      if (inputRef.current?.isFocused?.()) {
        consumeSearchFocus();
        return;
      }
      if (attempt >= RETRY_DELAYS.length) {
        // Out of retries: the input is mounted and we issued focus() — clear the
        // latch anyway so a later unrelated mount doesn't re-trigger.
        consumeSearchFocus();
        return;
      }
      const handle = setTimeout(() => tryFocus(attempt + 1), RETRY_DELAYS[attempt]);
      timers.push(handle);
    };

    const interaction = InteractionManager.runAfterInteractions(() => {
      tryFocus(0);
    });

    return () => {
      cancelled = true;
      interaction.cancel();
      timers.forEach(clearTimeout);
    };
  }, [consumeSearchFocus]);

  // Path A — input already mounted, user taps the search row again: the nonce
  // bumps on every tap, so focus fires each time even if the sheet is open.
  const lastHandledFocusNonceRef = useRef(searchFocusNonce);
  useEffect(() => {
    if (!autoFocusOnSignal) return;
    if (searchFocusNonce === lastHandledFocusNonceRef.current) return;
    lastHandledFocusNonceRef.current = searchFocusNonce;
    return runFocus();
  }, [autoFocusOnSignal, searchFocusNonce, runFocus]);

  // Path B — input mounts FRESH after the tap (sheet switches list→filters and
  // mounts MapSearchInput only AFTER the nonce already bumped, so Path A's effect
  // sees no change on first mount). The latched `pendingSearchFocus` flag survives
  // that gap; consuming it here grabs focus on first mount and clears the latch.
  useEffect(() => {
    if (!autoFocusOnSignal) return;
    if (!pendingSearchFocus) return;
    return runFocus();
  }, [autoFocusOnSignal, pendingSearchFocus, runFocus]);

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
        <FocusableInput
          ref={inputRef}
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
      marginBottom: 4,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 10,
      minHeight: 42,
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
      marginRight: 6,
    },
    input: {
      flex: 1,
      // Native keeps the compact 13px; on web we need 16px to avoid iOS
      // Safari's auto-zoom on input focus, which breaks the map viewport.
      fontSize: Platform.OS === 'web' ? 16 : 13,
      color: colors.text,
      fontWeight: '500',
      paddingVertical: 6,
      ...(Platform.OS === 'web'
        ? ({
          outlineWidth: 0,
          outlineStyle: 'none',
          outlineColor: 'transparent',
        } as any)
        : null),
    },
    clearButton: {
      padding: 3,
      marginLeft: 2,
    },
    resultsHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 3,
      marginLeft: 2,
    },
  });

export default React.memo(MapSearchInput);
