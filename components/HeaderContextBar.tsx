// components/HeaderContextBar.tsx
// ✅ МИГРАЦИЯ: Полная миграция на DESIGN_TOKENS и useThemedColors
// ✅ УЛУЧШЕНИЕ: Добавлена адаптивная навигация с breadcrumbs
// ✅ ДОСТУПНОСТЬ: Улучшены ARIA атрибуты и keyboard navigation

import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { usePathname, useRouter } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useBreadcrumbModel } from '@/hooks/useBreadcrumbModel';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useTravelSectionsStore } from '@/stores/travelSectionsStore';
import { useMapPanelStore } from '@/stores/mapPanelStore';

type HeaderContextBarProps = {
  testID?: string;
};

export default function HeaderContextBar({ testID }: HeaderContextBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const requestOpen = useTravelSectionsStore((s) => s.requestOpen);
  const requestToggleMapPanel = useMapPanelStore((s) => s.requestToggle);

  const model = useBreadcrumbModel();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const containerStyle = useMemo(() => {
    return [styles.container, isMobile && styles.containerMobile];
  }, [isMobile, styles]);

  if (isMobile) {
    const isMap = pathname === '/map';
    const isUserPoints = pathname === '/userpoints';
    const canOpenSections = typeof pathname === 'string' && pathname.startsWith('/travels/');
    return (
      <View testID={testID ?? 'header-context-bar'} style={containerStyle}>
        <View style={styles.mobileRow}>
          <Pressable
            onPress={() => {
              if (model.backToPath) {
                router.push(model.backToPath as any);
                return;
              }
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={[styles.backButton, globalFocusStyles.focusable]}
          >
            <Feather name="arrow-left" size={18} color={colors.text} />
          </Pressable>

          <Text style={styles.mobileTitle} numberOfLines={1}>
            {model.currentTitle}
          </Text>

          {isMap || isUserPoints ? (
            <Pressable
              onPress={requestToggleMapPanel}
              accessibilityRole="button"
              accessibilityLabel="Открыть или закрыть панель"
              style={[styles.mobileSectionsButton, globalFocusStyles.focusable]}
              testID="map-panel-open"
            >
              <Feather name="menu" size={18} color={colors.textMuted} />
            </Pressable>
          ) : canOpenSections ? (
            <Pressable
              onPress={requestOpen}
              accessibilityRole="button"
              accessibilityLabel="Открыть секции"
              style={[styles.mobileSectionsButton, globalFocusStyles.focusable]}
              testID="mobile-sections-open"
            >
              <Feather name="list" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.mobileRightSpacer} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      testID={testID ?? 'header-context-bar'}
      style={containerStyle}
      {...(Platform.OS === 'web' ? ({ role: 'navigation', 'aria-label': 'Breadcrumb' } as any) : {})}
    >
      {model.showBreadcrumbs ? (
        <View style={styles.crumbRow}>
          <Pressable
            onPress={() => router.push('/' as any)}
            accessibilityRole="button"
            accessibilityLabel="Перейти на Главную"
            style={({ pressed }) => [styles.crumbItem, pressed && styles.crumbItemPressed, globalFocusStyles.focusable]}
          >
            <Text style={styles.crumbLabel}>Главная</Text>
          </Pressable>

          {model.items.map((item, idx) => {
            const isLast = idx === model.items.length - 1;
            return (
              <React.Fragment key={item.path}>
                <Feather name="chevron-right" size={14} color={colors.textMuted} style={styles.separator} />
                <Pressable
                  onPress={() => {
                    if (isLast) return;
                    router.push(item.path as any);
                  }}
                  disabled={isLast}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? `Текущая страница: ${item.label}` : `Перейти на ${item.label}`}
                  {...(Platform.OS === 'web' && isLast
                    ? ({ 'aria-current': 'page' } as any)
                    : {})}
                  style={({ pressed }) => [
                    styles.crumbItem,
                    isLast && styles.crumbItemLast,
                    pressed && !isLast && styles.crumbItemPressed,
                    globalFocusStyles.focusable,
                  ]}
                >
                  <Text style={[styles.crumbLabel, isLast && styles.crumbLabelLast]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
      ) : (
        <Text style={styles.pageContext} numberOfLines={1}>
          {model.pageContextTitle}
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    minHeight: 32,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'web' ? colors.backgroundSecondary : colors.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  containerMobile: {
    minHeight: 40,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  crumbItem: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  crumbItemLast: {
    opacity: 1,
  },
  crumbItemPressed: {
    opacity: 0.7,
  },
  separator: {
    marginHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  crumbLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  crumbLabelLast: {
    color: colors.text,
    fontWeight: '600',
  },
  pageContext: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  backButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  mobileRightSpacer: {
    width: 40,
    height: 40,
  },
  mobileSectionsButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.72,
  },
});
