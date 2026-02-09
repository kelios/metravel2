/**
 * MapBottomSheet - мобильная панель снизу с 3 состояниями
 * Заменяет боковую панель на мобильных устройствах
 */

import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Platform, View, Text, StyleSheet, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';

interface MapBottomSheetProps {
  children: React.ReactNode;
  /** Заголовок панели */
  title?: string;
  /** Подзаголовок (например, количество мест) */
  subtitle?: string;
  /** Контент для peek preview (collapsed состояние) */
  peekContent?: React.ReactNode;
  /** Нижний отступ (например, высота нижнего dock на web) */
  bottomInset?: number;
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
  ({ children, title, subtitle, peekContent, bottomInset = 0, onStateChange }, ref) => {
    const colors = useThemedColors();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const lastProgrammaticOpenTsRef = useRef(0);
    const [sheetIndex, setSheetIndex] = useState(-1);

    const hasHeaderText = Boolean(title || subtitle);

    const contentBottomPadding = Platform.OS === 'web' ? 12 + bottomInset : 40 + bottomInset;

    const snapPoints = useMemo(
      () => (Platform.OS === 'web' ? ['70%', '80%'] : ['55%', '80%']),
      []
    );

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      snapToCollapsed: () => {
        if (Platform.OS === 'web') {
          setSheetIndex(-1);
          onStateChange?.('collapsed');
          return;
        }
        bottomSheetRef.current?.close();
      },
      snapToHalf: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        if (Platform.OS === 'web') {
          setSheetIndex(0);
          onStateChange?.('half');
          return;
        }
        bottomSheetRef.current?.snapToIndex(0);
      },
      snapToFull: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        if (Platform.OS === 'web') {
          setSheetIndex(1);
          onStateChange?.('full');
          return;
        }
        bottomSheetRef.current?.snapToIndex(1);
      },
      close: () => {
        if (Platform.OS === 'web') {
          setSheetIndex(-1);
          onStateChange?.('collapsed');
          return;
        }
        bottomSheetRef.current?.close();
      },
    }));

    // Handle snap point changes
    const handleSheetChanges = useCallback(
      (index: number) => {
        setSheetIndex(index);
        if (!onStateChange) return;

        if (index < 0) {
          onStateChange('collapsed');
          return;
        }

        const states: ('half' | 'full')[] = ['half', 'full'];
        onStateChange(states[index] || 'collapsed');
      },
      [onStateChange]
    );

    // Render backdrop for half/full states
    const renderBackdrop = useCallback(
      (props: any) => {
        if (Platform.OS === 'web') {
          return null;
        }

        return (
          <View
            testID="map-panel-overlay"
            style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}
          >
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

    const handleClosePress = useCallback(() => {
      if (Platform.OS === 'web') {
        setSheetIndex(-1);
        onStateChange?.('collapsed');
        return;
      }
      bottomSheetRef.current?.close();
    }, [onStateChange]);

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={Platform.OS === 'web' ? sheetIndex : -1}
        snapPoints={snapPoints}
        bottomInset={bottomInset}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.indicator}
        backgroundStyle={styles.background}
        style={styles.sheet}
      >
        {/* Header - always visible */}
        <View style={[styles.header, !hasHeaderText && styles.headerNoTitle]}>
          <View style={styles.headerContent}>
            {!!title && (
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{title}</Text>
                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.headerActions}>
            <IconButton
              icon={<Feather name="x" size={20} color={colors.textMuted} />}
              label="Закрыть панель"
              size="sm"
              onPress={handleClosePress}
              testID="map-panel-close"
              style={styles.headerButton}
            />
          </View>
        </View>

        {/* Peek content - shown in collapsed state */}
        {peekContent && sheetIndex < 0 && (
          <View style={styles.peekContent}>
            {peekContent}
          </View>
        )}

        {/* Main content - let children control their own scrolling (avoids nested scroll + keeps sticky footers working) */}
        <BottomSheetView
          style={[
            styles.contentContainer,
            { paddingBottom: contentBottomPadding },
          ]}
        >
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
      ...Platform.select({
        web: {
          zIndex: 50,
          boxShadow: 'none',
        } as any,
        default: {
          ...(colors.shadows?.light ?? {}),
        },
      }),
    },
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    indicator: {
      backgroundColor: colors.borderLight,
      width: 28,
      height: 2,
      borderRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerNoTitle: {
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 0,
    },
    headerContent: {
      flex: 1,
    },
    titleContainer: {
      flexDirection: 'column',
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    peekContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      ...Platform.select({
        web: {
          flex: 1,
          minHeight: 0,
          // @ts-ignore: web-only style
          overflowY: 'auto',
          // @ts-ignore: web-only style
          WebkitOverflowScrolling: 'touch',
          // @ts-ignore: web-only style
          touchAction: 'manipulation',
        },
        default: {
          flex: 1,
        },
      }),
    },
  });
