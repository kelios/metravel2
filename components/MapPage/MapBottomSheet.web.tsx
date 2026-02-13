/**
 * Web-only MapBottomSheet implementation.
 *
 * IMPORTANT: Do not import `@gorhom/bottom-sheet` on web.
 * Its module initialization depends on Reanimated/Worklets and can crash the web bundle.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';

interface MapBottomSheetProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  peekContent?: React.ReactNode;
  bottomInset?: number;
  onStateChange?: (state: 'collapsed' | 'quarter' | 'half' | 'full') => void;
}

export interface MapBottomSheetRef {
  snapToCollapsed: () => void;
  snapToQuarter: () => void;
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
      snapToQuarter: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        setSheetIndex(0);
        onStateChange?.('quarter');
      },
      snapToHalf: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        setSheetIndex(1);
        onStateChange?.('half');
      },
      snapToFull: () => {
        lastProgrammaticOpenTsRef.current = Date.now();
        setSheetIndex(2);
        onStateChange?.('full');
      },
      close: () => {
        setSheetIndex(-1);
        onStateChange?.('collapsed');
      },
    }));

    const { height: windowHeight } = useWindowDimensions();
    const webDomRef = useRef<HTMLElement | null>(null);

    const isCollapsed = sheetIndex < 0;
    // Pixel-based snap heights (vh units don't work reliably in RN Web View styles)
    const SNAP_RATIOS = [0.25, 0.55, 0.85] as const;
    const openHeight = !isCollapsed
      ? Math.round(windowHeight * (SNAP_RATIOS[sheetIndex] ?? 0.55))
      : 0;

    // Stable ref callback — only captures the DOM node, never changes.
    const webRefCallback = useCallback((node: View | null) => {
      webDomRef.current = node as unknown as HTMLElement | null;
    }, []);

    // Apply height imperatively whenever state changes.
    // RN Web View ignores pixel height set via style props.
    useEffect(() => {
      const node = webDomRef.current;
      if (!node) return;
      if (isCollapsed) {
        node.style.height = peekContent ? 'auto' : '0px';
        node.style.maxHeight = peekContent ? 'none' : '0px';
      } else {
        node.style.height = `${openHeight}px`;
        node.style.maxHeight = `${openHeight}px`;
      }
    }, [isCollapsed, openHeight, peekContent]);

    const handleClose = useCallback(() => {
      const dt = Date.now() - lastProgrammaticOpenTsRef.current;
      if (dt < 250) return;
      setSheetIndex(-1);
      onStateChange?.('collapsed');
    }, [onStateChange]);

    const handlePeekTap = useCallback(() => {
      lastProgrammaticOpenTsRef.current = Date.now();
      setSheetIndex(0);
      onStateChange?.('quarter');
    }, [onStateChange]);

    return (
      <View
        ref={webRefCallback}
        style={[
          styles.webRoot,
          isCollapsed ? styles.webRootCollapsed : null,
          isCollapsed && !peekContent ? styles.webRootHidden : null,
          { bottom: bottomInset, pointerEvents: isCollapsed && !peekContent ? 'none' as const : 'auto' as const },
        ]}
        accessibilityLabel="Панель карты"
      >
        {/* Drag handle — always visible as affordance */}
        <Pressable
          onPress={isCollapsed ? handlePeekTap : handleClose}
          style={styles.dragHandleArea}
          accessibilityLabel={isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          accessibilityRole="button"
        >
          <View style={styles.dragHandle} />
        </Pressable>

        {sheetIndex > 0 && (!!title || !!subtitle) && (
          <View style={styles.header}>
            <View style={styles.headerContent}>
              {!!title && (
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>{title}</Text>
                  {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
          {isCollapsed ? peekContent : children}
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
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.heavy,
            transition: 'height 200ms ease-out',
          } as any)
        : null),
    },
    webRootCollapsed: {
      overflow: 'visible' as any,
    },
    webRootHidden: {
      ...(Platform.OS === 'web' ? ({ display: 'none' } as any) : null),
    },
    dragHandleArea: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', touchAction: 'manipulation' } as any) : null),
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
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

