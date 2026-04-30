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
import useBreadcrumbModelDefault, {
  useBreadcrumbModel as useBreadcrumbModelNamed,
  type BreadcrumbModel,
} from '@/hooks/useBreadcrumbModel';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useTravelSectionsStore } from '@/stores/travelSectionsStore';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import BreadcrumbsJsonLd from '@/components/seo/BreadcrumbsJsonLd';
import {
  resolveHeaderContextBarAction,
  resolveHeaderContextBarIsMobile,
} from './headerContextBarModel';

const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm;

const useBreadcrumbModelSafe: () => BreadcrumbModel =
  typeof useBreadcrumbModelNamed === 'function'
    ? useBreadcrumbModelNamed
    : typeof useBreadcrumbModelDefault === 'function'
      ? (useBreadcrumbModelDefault as any)
      : (() => ({
          items: [],
          depth: 1,
          currentTitle: 'Путешествия',
          pageContextTitle: 'Путешествия',
          backToPath: null,
          showBreadcrumbs: false,
        }) as BreadcrumbModel);

type HeaderContextBarProps = {
  testID?: string;
};

type ActionButtonProps = {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress: () => void;
  style: any;
  testID?: string;
};

function ActionButton({ accessibilityLabel, children, onPress, style, testID }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[style, globalFocusStyles.focusable]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function HeaderContextBar({ testID }: HeaderContextBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemedColors();
  const { isPhone, isLargePhone, width } = useResponsive();
  const isJestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;
  const isMobile = resolveHeaderContextBarIsMobile({ width, isPhone, isLargePhone, isJestEnv });
  const requestOpen = useTravelSectionsStore((s) => s.requestOpen);
  const requestToggleMapPanel = useMapPanelStore((s) => s.requestToggle);

  const model = useBreadcrumbModelSafe();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleBackPress = () => {
    if (model.backToPath) {
      router.push(model.backToPath as any);
      return;
    }

    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/' as any);
  };

  const containerStyle = useMemo(() => {
    return [styles.container, isMobile && styles.containerMobile];
  }, [isMobile, styles]);

  if (isMobile) {
    const mobileAction = resolveHeaderContextBarAction(pathname);
    return (
      <>
        <BreadcrumbsJsonLd model={model} pathname={pathname} />
        <View testID={testID ?? 'header-context-bar'} style={containerStyle}>
          <View style={styles.mobileRow}>
            <ActionButton
              accessibilityLabel="Назад"
              onPress={handleBackPress}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={18} color={colors.text} />
            </ActionButton>

            <View style={styles.mobileTitleWrap}>
              <Text style={styles.mobileEyebrow}>Навигация</Text>
              <Text style={styles.mobileTitle} numberOfLines={1}>
                {model.currentTitle}
              </Text>
            </View>

            {mobileAction === 'map-panel' ? (
              <ActionButton
                accessibilityLabel="Открыть или закрыть панель"
                onPress={requestToggleMapPanel}
                style={styles.mobileSectionsButton}
                testID="map-panel-open"
              >
                <Feather name="menu" size={18} color={colors.textMuted} />
              </ActionButton>
            ) : mobileAction === 'travel-sections' ? (
              <ActionButton
                accessibilityLabel="Открыть секции"
                onPress={requestOpen}
                style={styles.mobileSectionsButton}
                testID="mobile-sections-open"
              >
                <Feather name="list" size={18} color={colors.textMuted} />
              </ActionButton>
            ) : (
              <View style={styles.mobileRightSpacer} />
            )}
          </View>
        </View>
      </>
    );
  }

  // On desktop, hide context bar when there are no breadcrumbs (page name is already in nav)
  if (!model.showBreadcrumbs) {
    return <BreadcrumbsJsonLd model={model} pathname={pathname} />;
  }

  return (
    <>
      <BreadcrumbsJsonLd model={model} pathname={pathname} />
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
              <Feather name="home" size={13} color={colors.textMuted} />
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
    </>
  );
}

export default React.memo(HeaderContextBar);

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    minHeight: 40,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: ((colors.boxShadows as any)?.light ?? DESIGN_TOKENS.shadows.light) as any,
        backdropFilter: 'blur(12px) saturate(1.05)' as any,
        WebkitBackdropFilter: 'blur(12px) saturate(1.05)' as any,
      } as any,
    }),
  },
  containerMobile: {
    minHeight: 52,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
    flexWrap: 'wrap',
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    borderRadius: CONTROL_RADIUS,
    minHeight: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  crumbItemLast: {
    opacity: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderLight,
  },
  crumbItemPressed: {
    opacity: 0.7,
    backgroundColor: colors.surfaceMuted,
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CONTROL_RADIUS,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mobileTitleWrap: {
    flex: 1,
    gap: 2,
  },
  mobileEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  mobileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  mobileRightSpacer: {
    width: 40,
    height: 40,
  },
  mobileSectionsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.88,
    borderRadius: CONTROL_RADIUS,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
