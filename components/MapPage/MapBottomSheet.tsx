/**
 * MapBottomSheet - мобильная панель снизу с 3 состояниями
 * Заменяет боковую панель на мобильных устройствах
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
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

    // 3 состояния: collapsed (10%), half (50%), full (90%)
    const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      snapToCollapsed: () => bottomSheetRef.current?.snapToIndex(0),
      snapToHalf: () => bottomSheetRef.current?.snapToIndex(1),
      snapToFull: () => bottomSheetRef.current?.snapToIndex(2),
      close: () => bottomSheetRef.current?.close(),
    }));

    // Handle snap point changes
    const handleSheetChanges = useCallback(
      (index: number) => {
        if (!onStateChange) return;

        const states: ('collapsed' | 'half' | 'full')[] = ['collapsed', 'half', 'full'];
        onStateChange(states[index] || 'collapsed');
      },
      [onStateChange]
    );

    // Render backdrop for full state
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={1}
          appearsOnIndex={2}
          opacity={0.5}
        />
      ),
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
        {peekContent && (
          <View style={styles.peekContent}>
            {peekContent}
          </View>
        )}

        {/* Main content - scrollable */}
        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          {children}
        </BottomSheetScrollView>
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
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
  });
