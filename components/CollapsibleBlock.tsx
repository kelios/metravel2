// components/CollapsibleBlock.tsx
// ✅ РЕДИЗАЙН: Универсальный компонент для сворачиваемых блоков

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, LayoutAnimation } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface CollapsibleBlockProps {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  defaultHidden?: boolean;
  expanded?: boolean; // ✅ ИСПРАВЛЕНИЕ: Контролируемое состояние
  hidden?: boolean; // ✅ ИСПРАВЛЕНИЕ: Контролируемое состояние
  collapsible?: boolean;
  hasCloseButton?: boolean;
  onToggle?: (expanded: boolean) => void;
  onHide?: (hidden: boolean) => void;
  headerActions?: React.ReactNode;
  compactMode?: boolean;
  minHeight?: number;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export default function CollapsibleBlock({
  id,
  title,
  description,
  icon,
  children,
  defaultExpanded = true,
  defaultHidden = false,
  expanded: controlledExpanded,
  hidden: controlledHidden,
  collapsible = true,
  hasCloseButton = true,
  onToggle,
  onHide,
  headerActions,
  compactMode = false,
  minHeight = 0,
}: CollapsibleBlockProps) {
  // ✅ ИСПРАВЛЕНИЕ: Используем контролируемое состояние если передано, иначе внутреннее
  const isControlled = controlledExpanded !== undefined || controlledHidden !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const [internalHidden, setInternalHidden] = useState(defaultHidden);
  
  const isExpanded = isControlled ? (controlledExpanded ?? defaultExpanded) : internalExpanded;
  const isHidden = isControlled ? (controlledHidden ?? defaultHidden) : internalHidden;
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<View>(null);
  // ✅ ИСПРАВЛЕНИЕ: Используем актуальное значение для инициализации анимации
  const initialExpanded = isControlled ? (controlledExpanded ?? defaultExpanded) : defaultExpanded;
  const initialHidden = isControlled ? (controlledHidden ?? defaultHidden) : defaultHidden;
  const animatedHeight = useRef(new Animated.Value(initialExpanded ? 1 : 0)).current;
  const animatedOpacity = useRef(new Animated.Value(initialHidden ? 0 : 1)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [isExpanded, isHidden]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: isHidden ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpanded, isHidden, animatedHeight, animatedOpacity]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newExpanded);
    }
    onToggle?.(newExpanded);
  };

  const handleHide = () => {
    const newHidden = !isHidden;
    if (!isControlled) {
      setInternalHidden(newHidden);
    }
    onHide?.(newHidden);
  };

  const handleContentLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && height !== contentHeight) {
      setContentHeight(height);
    }
  };

  if (isHidden) {
    return (
      <View style={styles.hiddenBlock}>
        <Pressable
          onPress={handleHide}
          style={styles.showHiddenButton}
          accessibilityLabel={`Показать блок: ${title}`}
        >
          <Feather name="eye-off" size={14} color={palette.textMuted} />
          <Text style={styles.showHiddenText}>Показать: {title}</Text>
        </Pressable>
      </View>
    );
  }

  const heightInterpolated = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [minHeight, contentHeight || 'auto'] as any,
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: animatedOpacity },
        compactMode && styles.containerCompact,
      ]}
      {...Platform.select({
        web: {
          // @ts-ignore
          'data-block-id': id,
        },
      })}
    >
      {/* Заголовок блока */}
      <View style={[styles.header, compactMode && styles.headerCompact]}>
        <Pressable
          onPress={collapsible ? handleToggle : undefined}
          style={styles.headerLeft}
          disabled={!collapsible}
          {...Platform.select({
            web: {
              cursor: collapsible ? 'pointer' : 'default',
            },
          })}
        >
          {icon && (
            <View style={styles.iconWrapper}>
              <Feather 
                name={icon as any} 
                size={compactMode ? 16 : 18} 
                color={palette.primary} 
                style={styles.headerIcon}
              />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.title, compactMode && styles.titleCompact]}>{title}</Text>
            {description && !compactMode && (
              <Text style={styles.description} numberOfLines={1}>{description}</Text>
            )}
            {/* ✅ UX УЛУЧШЕНИЕ: Индикатор что блок можно развернуть */}
            {collapsible && !isExpanded && (
              <Text style={styles.expandHint} numberOfLines={1}>
                Нажмите чтобы развернуть
              </Text>
            )}
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          {headerActions}
          
          {collapsible && (
            <Pressable
              onPress={handleToggle}
              style={styles.actionButton}
              accessibilityLabel={isExpanded ? 'Свернуть блок' : 'Развернуть блок'}
              hitSlop={8}
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore
                  ':hover': {
                    backgroundColor: palette.primarySoft,
                  },
                },
              })}
            >
              <Feather 
                name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                size={16} 
                color={palette.textMuted} 
              />
            </Pressable>
          )}

          {hasCloseButton && (
            <Pressable
              onPress={handleHide}
              style={styles.actionButton}
              accessibilityLabel="Скрыть блок"
              hitSlop={8}
              {...Platform.select({
                web: {
                  cursor: 'pointer',
                  // @ts-ignore
                  ':hover': {
                    backgroundColor: palette.primarySoft,
                  },
                },
              })}
            >
              <Feather name="x" size={16} color={palette.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Содержимое блока с анимацией */}
      <Animated.View
        style={[
          styles.content,
          {
            maxHeight: Platform.OS === 'web' ? (isExpanded ? 'none' : 0) : heightInterpolated,
            overflow: Platform.OS === 'web' ? (isExpanded ? 'visible' : 'hidden') : 'hidden',
          },
        ]}
        onLayout={handleContentLayout}
      >
        <View ref={contentRef} style={styles.contentInner}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles: any = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  containerCompact: {
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    minHeight: 48,
  },
  headerCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 40,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: palette.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    // Иконка теперь внутри wrapper
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 2,
  },
  titleCompact: {
    fontSize: 14,
  },
  description: {
    fontSize: 12,
    color: palette.textMuted,
  },
  expandHint: {
    fontSize: 11,
    color: palette.textSubtle,
    fontStyle: 'italic',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
    minHeight: 32,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  content: {
    ...Platform.select({
      web: {
        transition: 'max-height 0.3s ease',
      },
    }),
  },
  contentInner: {
    padding: spacing.md,
  },
  hiddenBlock: {
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  showHiddenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: palette.primarySoft,
    minHeight: 32,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
  },
  showHiddenText: {
    fontSize: 12,
    color: palette.primary,
    fontWeight: '500',
  },
} as any);

