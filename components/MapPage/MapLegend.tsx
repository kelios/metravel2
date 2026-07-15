import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface MapLegendProps {
  showRouteMode?: boolean;
}

function MapLegend({ showRouteMode = false }: MapLegendProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const legendItems = useMemo(() => {
    const items = [
      {
        icon: 'map-pin',
        color: colors.warning,
        background: colors.warningLight,
        label: i18nT('map:components.MapPage.MapLegend.puteshestviya_ceccab46'),
        description: i18nT('map:components.MapPage.MapLegend.mesta_dlya_posescheniya_3e19e009'),
      },
      {
        icon: 'map-pin',
        color: colors.success,
        background: colors.successLight,
        label: i18nT('map:components.MapPage.MapLegend.start_3573c517'),
        description: i18nT('map:components.MapPage.MapLegend.nachalo_marshruta_be91b36f'),
      },
      {
        icon: 'map-pin',
        color: colors.danger,
        background: colors.dangerLight,
        label: i18nT('map:components.MapPage.MapLegend.finish_79e86417'),
        description: i18nT('map:components.MapPage.MapLegend.konets_marshruta_454a7658'),
      },
      {
        icon: 'navigation',
        color: colors.info,
        background: colors.infoLight,
        label: i18nT('map:components.MapPage.MapLegend.vashe_mestopolozhenie_9ef80275'),
        description: i18nT('map:components.MapPage.MapLegend.tekuschaya_pozitsiya_9113c6fc'),
      },
    ];

    if (showRouteMode) {
      items.push({
        // Feather не имеет иконки "route" — используем "trending-up" как аналог направления
        icon: 'trending-up',
        color: colors.accent,
        background: colors.accentLight,
        label: i18nT('map:components.MapPage.MapLegend.marshrut_247e30ee'),
        description: i18nT('map:components.MapPage.MapLegend.postroennyy_put_52f0be48'),
      });
    }

    return items;
  }, [colors, showRouteMode]);

  const [collapsed, setCollapsed] = useState(true);

  return (
    <View
      style={[styles.container, isMobile && styles.containerMobile]}
      role="region"
      accessibilityLabel={i18nT('map:components.MapPage.MapLegend.legenda_karty_dd352994')}
    >
      <Pressable
        style={({ pressed }) => [styles.header, collapsed && styles.headerCollapsed, pressed && { opacity: 0.7 }]}
        onPress={() => setCollapsed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? i18nT('map:components.MapPage.MapLegend.pokazat_legendu_14943ba1') : i18nT('map:components.MapPage.MapLegend.skryt_legendu_8a28fd89')}
        accessibilityState={{ expanded: !collapsed }}
      >
        <Feather name="info" size={16} color={colors.textMuted} />
        <Text style={styles.title} accessibilityRole="header">{i18nT('map:components.MapPage.MapLegend.legenda_karty_dd352994')}</Text>
        <Feather name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color={colors.textMuted} />
      </Pressable>
      {!collapsed && (
        <View style={styles.items} accessibilityRole="list">
          {legendItems.map((item, index) => (
            <View
              key={index}
              style={styles.item}
              {...(Platform.OS === 'web' ? ({ role: 'listitem' } as any) : {})}
              accessibilityLabel={`${item.label}: ${item.description}`}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.background }]}>
                <Feather name={item.icon as any} size={14} color={item.color} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.label}>{item.label}</Text>
                {!isMobile && (
                  <Text style={styles.description}>{item.description}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerMobile: {
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  headerCollapsed: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  items: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  description: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default React.memo(MapLegend);
