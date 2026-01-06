/**
 * MapBottomSheet - мобильная панель снизу с 3 состояниями
 * Заменяет боковую панель на мобильных устройствах
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Platform, View, Text, StyleSheet, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MapIcon from './MapIcon';

interface MapBottomSheetProps {
  children: React.ReactNode;
  /** Заголовок панели */
  title?: string;
  /** Подзаголовок (например, количество мест) */
  subtitle?: string;
  /** Контент для peek preview (collapsed состояние) */
  peekContent?: React.ReactNode;
  /** Callback при изменении состояния */
  onStateChange?: (state: 'collapsed' | 'half' | 'full') => void;
}

export interface MapBottomSheetRef {
  snapToCollapsed: () => void;
  snapToHalf: () => void;
  snapToFull: () => void;
  close: () => void;
}

const MapBottomSheet = forwardRef<MapBottomSheetRef, MapBottomSheetProps>(
  ({ children, title, subtitle, peekContent, onStateChange }, ref) => {
    const colors = useThemedColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const lastProgrammaticOpenTsRef = useRef(0);
    const [sheetIndex, setSheetIndex] = useState(0);

    // 3 состояния: collapsed (10%), half (50%), full (90%)
    const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      snapToCollapsed: () => bottomSheetRef.current?.snapToIndex(0),
      snapToHalf: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        bottomSheetRef.current?.snapToIndex(1);
      },
      snapToFull: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        bottomSheetRef.current?.snapToIndex(2);
      },
      close: () => bottomSheetRef.current?.close(),
    }));

    // Handle snap point changes
    const handleSheetChanges = useCallback(
      (index: number) => {
        setSheetIndex(index);
        if (!onStateChange) return;

        const states: ('collapsed' | 'half' | 'full')[] = ['collapsed', 'half', 'full'];
        onStateChange(states[index] || 'collapsed');
      },
      [onStateChange]
    );

    // Render backdrop for half/full states
    const renderBackdrop = useCallback(
      (props: any) => {
        // On web, MapMobileLayout renders its own overlay for e2e + UX parity.
        // Keeping a second Pressable backdrop here can cause immediate close on the same click.
        if (Platform.OS === 'web') {
          return (
            <BottomSheetBackdrop
              {...props}
              disappearsOnIndex={0}
              appearsOnIndex={1}
              opacity={0.5}
              pressBehavior="none"
            />
          );
        }

        return (
          <View testID="map-panel-overlay" style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <BottomSheetBackdrop
              {...props}
              disappearsOnIndex={0}
              appearsOnIndex={1}
              opacity={0.5}
              pressBehavior="none"
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                const dt = Date.now() - lastProgrammaticOpenTsRef.current;
                if (dt < 250) return;
                bottomSheetRef.current?.snapToIndex(0);
              }}
              accessibilityRole="button"
              accessibilityLabel="Закрыть панель карты"
            />
          </View>
        );
      },
      []
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={0} // Start at collapsed
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.indicator}
        backgroundStyle={styles.background}
        style={styles.sheet}
      >
        {/* Header - always visible */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {title && (
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerButton}
              onPress={() => bottomSheetRef.current?.snapToIndex(2)}
              hitSlop={8}
              accessibilityLabel="Развернуть панель"
            >
              <MapIcon name="expand-less" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Peek content - shown in collapsed state */}
        {peekContent && sheetIndex === 0 && (
          <View style={styles.peekContent}>
            {peekContent}
          </View>
        )}

        {/* Main content - let children control their own scrolling (avoids nested scroll + keeps sticky footers working) */}
        <BottomSheetView style={styles.contentContainer}>
          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

MapBottomSheet.displayName = 'MapBottomSheet';

export default MapBottomSheet;

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    sheet: {
      ...colors.shadows.heavy,
    },
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    indicator: {
      backgroundColor: colors.border,
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flex: 1,
    },
    titleContainer: {
      flexDirection: 'column',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    peekContent: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
  });
