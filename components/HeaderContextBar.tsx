import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useBreadcrumbModel } from '@/hooks/useBreadcrumbModel';
import { globalFocusStyles } from '@/styles/globalFocus';

const palette = DESIGN_TOKENS.colors;

type HeaderContextBarProps = {
  testID?: string;
};

export default function HeaderContextBar({ testID }: HeaderContextBarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= METRICS.breakpoints.tablet;

  const model = useBreadcrumbModel();

  const containerStyle = useMemo(() => {
    return [styles.container, isMobile && styles.containerMobile];
  }, [isMobile]);

  if (isMobile) {
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
            <Feather name="arrow-left" size={18} color={palette.text} />
          </Pressable>

          <Text style={styles.mobileTitle} numberOfLines={1}>
            {model.currentTitle}
          </Text>

          <View style={styles.mobileRightSpacer} />
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
                <Feather name="chevron-right" size={14} color={palette.textMuted} style={styles.separator} />
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

const styles = StyleSheet.create({
  container: {
    minHeight: 32,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'web' ? '#FBFAF8' : palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(17, 24, 39, 0.08)',
  },
  containerMobile: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  crumbItem: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  crumbItemLast: {
    opacity: 1,
  },
  crumbItemPressed: {
    opacity: 0.7,
  },
  separator: {
    marginHorizontal: 4,
  },
  crumbLabel: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '500',
  },
  crumbLabelLast: {
    color: palette.text,
    fontWeight: '600',
  },
  pageContext: {
    fontSize: 13,
    color: palette.text,
    fontWeight: '600',
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  mobileRightSpacer: {
    width: 36,
    height: 36,
  },
});
