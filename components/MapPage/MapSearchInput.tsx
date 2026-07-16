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
import { translate as i18nT } from '@/i18n'


// Keep the search input on the plain RN TextInput across platforms. The map
// sheet already leaves the field above the dock, and this avoids a native
// BottomSheetTextInput focus race where Android shows the field but never routes
// typed text into it.
const resolveFocusableInput = (): typeof TextInput => {
  return TextInput;
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
  /**
   * A11y strings default to the place-name search wording; reusers (e.g. the
   * category/tag search inside "Что посмотреть") pass their own.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const MapSearchInput: React.FC<MapSearchInputProps> = ({
  value,
  onChange,
  placeholder = i18nT('map:components.MapPage.MapSearchInput.poisk_mest_60640625'),
  onClear,
  resultsCount,
  testID = 'map-search-input',
  autoFocusOnSignal = false,
  accessibilityLabel = i18nT('map:components.MapPage.MapSearchInput.poisk_mest_na_karte_4fd4bc4a'),
  accessibilityHint = i18nT('map:components.MapPage.MapSearchInput.vvedite_nazvanie_mesta_dlya_poiska_baa10a27'),
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
  // only becomes focusable once the sheet open/snap animation finishes and the
  // input is mounted in the visible snap. A fixed delay races both, so the
  // keyboard never showed (mInputShown=false).
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

  const handleWrapperPress = useCallback(() => {
    if (Platform.OS === 'web') return;
    inputRef.current?.focus();
    runFocus();
  }, [runFocus]);

  const handleClear = useCallback(() => {
    onChange('');
    onClear?.();
  }, [onChange, onClear]);

  const showClear = value.length > 0;
  const showResultsHint = typeof resultsCount === 'number' && value.length > 0;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}
        onPressIn={handleWrapperPress}
      >
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
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        />
        {showClear && (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapSearchInput.ochistit_poisk_d606bb1e')}
            hitSlop={8}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </Pressable>
      {showResultsHint && (
        <Text style={styles.resultsHint}>
          {resultsCount === 0
            ? i18nT('map:components.MapPage.MapSearchInput.nichego_ne_naydeno_poprobuyte_drugoy_zapros_417ca1dd')
            : i18nT('map:components.MapPage.MapSearchInput.na_karte_podhodit_value1_ca0e0146', { value1: resultsCount })}
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
