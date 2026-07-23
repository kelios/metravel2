// components/HeaderContextBar.tsx
// ✅ МИГРАЦИЯ: Полная миграция на DESIGN_TOKENS и useThemedColors
// ✅ УЛУЧШЕНИЕ: Добавлена адаптивная навигация с breadcrumbs
// ✅ ДОСТУПНОСТЬ: Улучшены ARIA атрибуты и keyboard navigation

import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import BreadcrumbsJsonLd from '@/components/seo/BreadcrumbsJsonLd';
import {
  resolveHeaderContextBarAction,
  resolveHeaderContextBarIsMobile,
} from './headerContextBarModel';
import { isTravelUpsertHeaderPath } from './customHeaderModel';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { BOTTOM_DOCK_ITEM_DEFS } from './bottomDockModel';
import { translate as i18nT } from '@/i18n'


// Top-level tab routes that already show their identity in the bottom dock — for those we
// suppress the mobile context bar to avoid stealing 52px of vertical space for a redundant
// "back to /" affordance. `/profile` есть только в нижнем доке (не в HEADER_NAV_ITEMS),
// поэтому маршруты дока добавляем явно.
const TOP_LEVEL_TAB_PATHS = new Set<string>(
  ['/']
    .concat(HEADER_NAV_ITEMS.filter((item) => !item.external).map((item) => item.path))
    .concat(
      BOTTOM_DOCK_ITEM_DEFS.filter((item) => !item.isMore).map((item) => String(item.route)),
    ),
);

const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm;

const useBreadcrumbModelSafe: () => BreadcrumbModel =
  typeof useBreadcrumbModelNamed === 'function'
    ? useBreadcrumbModelNamed
    : typeof useBreadcrumbModelDefault === 'function'
      ? (useBreadcrumbModelDefault as any)
      : (() => ({
          items: [],
          depth: 1,
          currentTitle: i18nT('navigation:components.layout.HeaderContextBar.puteshestviya_2578a5d6'),
          pageContextTitle: i18nT('navigation:components.layout.HeaderContextBar.puteshestviya_2578a5d6'),
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
  const isMobile = resolveHeaderContextBarIsMobile({ width, isPhone, isLargePhone });
  const requestOpen = useTravelSectionsStore((s) => s.requestOpen);

  const model = useBreadcrumbModelSafe();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigateTo = (path: string, replace = false) => {
    const href = path as any;
    if (replace) {
      router.replace(href);
      return;
    }
    router.push(href);
  };
  const breadcrumbNavigationProps = Platform.OS === 'web'
    ? ({
        role: 'navigation',
        'aria-label': i18nT('navigation:components.layout.HeaderContextBar.breadcrumb_a3361b51'),
      } as any)
    : {};
  const currentPageProps = Platform.OS === 'web'
    ? ({ 'aria-current': 'page' } as any)
    : {};

  const handleBackPress = () => {
    // #573: prefer real navigation history so «Назад» returns to the screen the
    // user came from (search/feed/related lists), not the breadcrumb default
    // (which falls back to Home for any non-top-level origin). Use backToPath only
    // when there is no in-app history to pop (deep link / fresh tab open).
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    if (model.backToPath) {
      navigateTo(model.backToPath, true);
      return;
    }

    navigateTo('/', true);
  };

  const containerStyle = useMemo(() => {
    return [styles.container, isMobile && styles.containerMobile];
  }, [isMobile, styles]);

  if (isMobile) {
    const mobileAction = resolveHeaderContextBarAction(pathname);
    const isTopLevelTab = !!pathname && TOP_LEVEL_TAB_PATHS.has(pathname);
    // On top-level tabs the bottom dock already names the active section and there's nowhere
    // meaningful to go "back" to — hide the bar but keep emitting BreadcrumbsJsonLd for SEO.
    if (isTopLevelTab && mobileAction === 'none') {
      return <BreadcrumbsJsonLd model={model} pathname={pathname} />;
    }

    if (isTravelUpsertHeaderPath(pathname) && model.showBreadcrumbs) {
      return (
        <>
          <BreadcrumbsJsonLd model={model} pathname={pathname} />
          <View
            testID={testID ?? 'header-context-bar'}
            style={containerStyle}
            accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.breadcrumb_a3361b51')}
            {...breadcrumbNavigationProps}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mobileCrumbRow}
              style={styles.mobileCrumbScroll}
              testID="travel-upsert-breadcrumbs"
            >
              <Pressable
                onPress={() => navigateTo('/')}
                accessibilityRole="button"
                accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.pereyti_na_glavnuyu_7e7e6f6f')}
                style={({ pressed }) => [
                  styles.mobileCrumbHome,
                  pressed && styles.crumbItemPressed,
                  globalFocusStyles.focusable,
                ]}
              >
                <Feather name="home" size={15} color={colors.textMuted} />
              </Pressable>

              {model.items.map((item, idx) => {
                const isLast = idx === model.items.length - 1;
                return (
                  <React.Fragment key={`${item.path}-${idx}`}>
                    <Feather
                      name="chevron-right"
                      size={15}
                      color={colors.textMuted}
                      style={styles.mobileCrumbSeparator}
                    />
                    <Pressable
                      onPress={() => {
                        if (!isLast) navigateTo(item.path);
                      }}
                      disabled={isLast}
                      accessibilityRole="button"
                      accessibilityLabel={isLast
                        ? i18nT('navigation:components.layout.HeaderContextBar.tekuschaya_stranitsa_value1_fcf33568', { value1: item.label })
                        : i18nT('navigation:components.layout.HeaderContextBar.pereyti_na_value1_b32e0679', { value1: item.label })}
                      {...(isLast ? currentPageProps : {})}
                      style={({ pressed }) => [
                        styles.mobileCrumbItem,
                        isLast && styles.mobileCrumbItemLast,
                        pressed && !isLast && styles.crumbItemPressed,
                        globalFocusStyles.focusable,
                      ]}
                    >
                      <Text
                        style={[
                          styles.mobileCrumbLabel,
                          isLast && styles.mobileCrumbLabelLast,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>
        </>
      );
    }

    return (
      <>
        <BreadcrumbsJsonLd model={model} pathname={pathname} />
        <View testID={testID ?? 'header-context-bar'} style={containerStyle}>
          <View style={styles.mobileRow}>
            <ActionButton
              accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.nazad_ffc60b96')}
              onPress={handleBackPress}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={18} color={colors.text} />
            </ActionButton>

            <View style={styles.mobileTitleWrap}>
              <Text style={styles.mobileTitle} numberOfLines={1}>
                {model.currentTitle}
              </Text>
            </View>

            {/* #228 — на карте больше НЕ показываем кнопку «Найти места рядом»:
                она дублировала нижний вход «Списком · N» (оба открывали один и
                тот же шит списка). Единственный вход в список — нижняя кнопка в
                MapMobileLayout. Шапка карты остаётся (назад + заголовок). */}
            {mobileAction === 'travel-sections' ? (
              <ActionButton
                accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.otkryt_sektsii_5683d1a0')}
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
        {...breadcrumbNavigationProps}
      >
        {model.showBreadcrumbs ? (
          <View style={styles.crumbRow}>
            <Pressable
              onPress={() => navigateTo('/')}
              accessibilityRole="button"
              accessibilityLabel={i18nT('navigation:components.layout.HeaderContextBar.pereyti_na_glavnuyu_7e7e6f6f')}
              style={({ pressed }) => [styles.crumbItem, pressed && styles.crumbItemPressed, globalFocusStyles.focusable]}
            >
              <Feather name="home" size={13} color={colors.textMuted} />
              <Text style={styles.crumbLabel}>{i18nT('navigation:components.layout.HeaderContextBar.glavnaya_e5cb516e')}</Text>
            </Pressable>

            {model.items.map((item, idx) => {
              const isLast = idx === model.items.length - 1;
              return (
                <React.Fragment key={item.path}>
                  <Feather name="chevron-right" size={14} color={colors.textMuted} style={styles.separator} />
                  <Pressable
                    onPress={() => {
                      if (isLast) return;
                      navigateTo(item.path);
                    }}
                    disabled={isLast}
                    accessibilityRole="button"
                    accessibilityLabel={isLast ? i18nT('navigation:components.layout.HeaderContextBar.tekuschaya_stranitsa_value1_fcf33568', { value1: item.label }) : i18nT('navigation:components.layout.HeaderContextBar.pereyti_na_value1_b32e0679', { value1: item.label })}
                    {...(isLast ? currentPageProps : {})}
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
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
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
  mobileCrumbScroll: {
    flexGrow: 0,
  },
  mobileCrumbRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: DESIGN_TOKENS.spacing.sm,
  },
  mobileCrumbHome: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CONTROL_RADIUS,
  },
  mobileCrumbSeparator: {
    marginHorizontal: DESIGN_TOKENS.spacing.xxs,
  },
  mobileCrumbItem: {
    minHeight: 44,
    maxWidth: 240,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CONTROL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  mobileCrumbItemLast: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderLight,
  },
  mobileCrumbLabel: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  mobileCrumbLabelLast: {
    color: colors.text,
    fontWeight: '700',
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
