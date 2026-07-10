import { useMemo, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { globalFocusStyles } from '@/styles/globalFocus';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

export type ProfileCollectionBreadcrumb = {
  label: string;
  path?: string;
  icon?: FeatherIconName;
};

type Props = {
  title: string;
  subtitle?: string;
  onBackPress: () => void;
  breadcrumbs?: ProfileCollectionBreadcrumb[];
  onBreadcrumbPress?: (path: string) => void;
  showClearButton?: boolean;
  onClearPress?: () => void;
  clearAccessibilityLabel?: string;
  clearButtonText?: string;
  /**
   * Icon-only кнопка очистки (без текстовой подписи) — для экранов, где текст
   * дублирует уже видимую идентичность (напр. /history с глобальным контекст-баром).
   */
  compactClear?: boolean;
  backAccessibilityLabel?: string;
  /**
   * Компактная шапка для экранов с тяжёлым контентом под ней (календарь):
   * на телефоне держит заголовок и кнопку «Назад» в одной строке,
   * скрывает подзаголовок и поджимает вертикальные паддинги — чтобы под
   * фиксированной шапкой сразу был виден контент (правило «шапка ≤20%»).
   */
  dense?: boolean;
};

export default function ProfileCollectionHeader({
  title,
  subtitle = 'Профиль',
  onBackPress,
  breadcrumbs,
  onBreadcrumbPress,
  showClearButton = false,
  onClearPress,
  clearAccessibilityLabel = 'Очистить',
  clearButtonText = 'Очистить',
  compactClear = false,
  backAccessibilityLabel = 'Назад',
  dense = false,
}: Props) {
  const colors = useThemedColors();
  const { isPhone } = useResponsive();
  const stackOnPhone = isPhone && !dense;
  const visibleBreadcrumbs = breadcrumbs ?? [];
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingHorizontal: 16,
          paddingTop: dense ? 6 : 8,
          paddingBottom: dense ? 4 : 6,
        },
        headerRow: {
          flexDirection: stackOnPhone ? 'column' : 'row',
          alignItems: stackOnPhone ? 'stretch' : 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
        },
        headerTitleBlock: {
          flexGrow: 1,
          flexShrink: stackOnPhone ? 0 : 1,
          flexBasis: stackOnPhone ? 'auto' : 0,
        },
        breadcrumbRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: dense ? 4 : 6,
          minHeight: 20,
        },
        breadcrumbSegment: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        breadcrumbItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          borderRadius: DESIGN_TOKENS.radii.sm,
          minHeight: 32,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'transparent',
        },
        breadcrumbItemInteractive: {
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
        },
        breadcrumbItemLast: {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.borderLight,
        },
        breadcrumbItemPressed: {
          opacity: 0.7,
          backgroundColor: colors.surfaceMuted,
        },
        breadcrumbSeparator: {
          marginHorizontal: DESIGN_TOKENS.spacing.xs,
        },
        breadcrumbLabel: {
          fontSize: 13,
          color: colors.textMuted,
          fontWeight: '500',
        },
        breadcrumbLabelLast: {
          color: colors.text,
          fontWeight: '600',
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        },
        title: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        subtitle: {
          marginTop: 4,
          fontSize: 13,
          color: colors.textMuted,
        },
        clearButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.surface,
          minHeight: 40,
        },
        clearButtonCompact: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.surface,
        },
        clearButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.danger,
        },
        backToProfileButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surface,
          minHeight: 40,
        },
        backToProfileButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.primaryText,
        },
      }),
    [colors, dense, stackOnPhone]
  );

  return (
    <View style={styles.header}>
      {visibleBreadcrumbs.length > 0 && (
        <View
          style={styles.breadcrumbRow}
          {...(Platform.OS === 'web' ? ({ role: 'navigation', 'aria-label': 'Breadcrumb' } as any) : {})}
        >
          {visibleBreadcrumbs.map((item, index) => {
            const isLast = index === visibleBreadcrumbs.length - 1;
            const isInteractive = Boolean(item.path && !isLast && onBreadcrumbPress);

            return (
              <View key={`${item.path ?? item.label}-${index}`} style={styles.breadcrumbSegment}>
                {index > 0 && (
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.textMuted}
                    style={styles.breadcrumbSeparator}
                  />
                )}
                <Pressable
                  onPress={() => {
                    if (!item.path || isLast || !onBreadcrumbPress) return;
                    onBreadcrumbPress(item.path);
                  }}
                  disabled={!isInteractive}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? `Текущая страница: ${item.label}` : `Перейти на ${item.label}`}
                  {...(Platform.OS === 'web' && isLast ? ({ 'aria-current': 'page' } as any) : {})}
                  style={({ pressed }) => [
                    styles.breadcrumbItem,
                    isInteractive && styles.breadcrumbItemInteractive,
                    isLast && styles.breadcrumbItemLast,
                    pressed && isInteractive && styles.breadcrumbItemPressed,
                    globalFocusStyles.focusable,
                  ]}
                >
                  {item.icon ? <Feather name={item.icon} size={13} color={colors.textMuted} /> : null}
                  <Text
                    style={[styles.breadcrumbLabel, isLast && styles.breadcrumbLabelLast]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.headerRow}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>{title}</Text>
          {!dense && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.backToProfileButton, globalFocusStyles.focusable]}
            onPress={onBackPress}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="arrow-left" size={16} color={colors.primaryDark} />
            <Text style={styles.backToProfileButtonText}>Назад</Text>
          </Pressable>

          {showClearButton && typeof onClearPress === 'function' && (
            <Pressable
              style={[compactClear ? styles.clearButtonCompact : styles.clearButton, globalFocusStyles.focusable]}
              onPress={onClearPress}
              accessibilityRole="button"
              accessibilityLabel={clearAccessibilityLabel}
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
              {!compactClear && <Text style={styles.clearButtonText}>{clearButtonText}</Text>}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
