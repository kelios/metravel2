/**
 * Web-only MapBottomSheet implementation.
 *
 * IMPORTANT: Do not import `@gorhom/bottom-sheet` on web.
 * Its module initialization depends on Reanimated/Worklets and can crash the web bundle.
 */

import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';

interface MapBottomSheetProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  peekContent?: React.ReactNode;
  bottomInset?: number;
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
    const lastProgrammaticOpenTsRef = useRef(0);
    const [sheetIndex, setSheetIndex] = useState(-1);

    const contentBottomPadding = 12 + bottomInset;

    useImperativeHandle(ref, () => ({
      snapToCollapsed: () => {
        setSheetIndex(-1);
        onStateChange?.('collapsed');
      },
      snapToHalf: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        setSheetIndex(0);
        onStateChange?.('half');
      },
      snapToFull: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        setSheetIndex(1);
        onStateChange?.('full');
      },
      close: () => {
        setSheetIndex(-1);
        onStateChange?.('collapsed');
      },
    }));

    const sheetMaxHeight = sheetIndex < 0 ? 0 : sheetIndex === 0 ? '70vh' : '80vh';

    const handleClose = useCallback(() => {
      const dt = Date.now() - lastProgrammaticOpenTsRef.current;
      if (dt < 250) return;
      setSheetIndex(-1);
      onStateChange?.('collapsed');
    }, [onStateChange]);

    return (
      <View
        style={[
          styles.webRoot,
          {
            // @ts-ignore: web-only style
            height: (sheetIndex < 0 ? 0 : 'auto') as any,
            // @ts-ignore: web-only style
            maxHeight: sheetMaxHeight as any,
            bottom: bottomInset,
          },
        ]}
        accessibilityLabel="Панель карты"
      >
        {sheetIndex >= 0 && (
          <View style={styles.header}>
            <View style={styles.headerContent}>
              {title && (
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              <IconButton
                icon={<Feather name="x" size={20} color={colors.textMuted} />}
                label="Закрыть панель"
                size="sm"
                onPress={handleClose}
                testID="map-panel-close"
                style={styles.headerButton}
              />
            </View>
          </View>
        )}

        <View style={[styles.contentContainer, { paddingBottom: contentBottomPadding }]}>
          {sheetIndex < 0 ? peekContent : children}
        </View>
      </View>
    );
  }
);

MapBottomSheet.displayName = 'MapBottomSheet';

export default MapBottomSheet;

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    webRoot: {
      position: 'fixed',
      left: 0,
      right: 0,
      zIndex: 50,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? ({ boxShadow: colors.boxShadows.heavy } as any) : null),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerContent: {
      flex: 1,
      minWidth: 0,
    },
    titleContainer: {
      flexDirection: 'column',
      gap: 2,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
    },
    contentContainer: {
      flexGrow: 1,
      minHeight: 0,
      ...(Platform.OS === 'web'
        ? ({
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          } as any)
        : null),
    },
  });

