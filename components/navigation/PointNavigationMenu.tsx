import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import {
  getNavigationActionVisual,
  NAVIGATION_ACTION_LABELS,
  SEMANTIC_ACTION_ICON,
  type NavigationActionKind,
} from './navigationActionMeta'
import { translate as i18nT } from '@/i18n'


type PointNavigationMenuProps = {
  coord?: string | null
  label?: string
  testIDPrefix?: string
}

const PRESSED_OPACITY = { opacity: 0.72 } as const

export default function PointNavigationMenu({
  coord,
  label = i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_v_navigatore_42bff582'),
  testIDPrefix = 'point-navigation',
}: PointNavigationMenuProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [expanded, setExpanded] = useState(false)

  const actions = useMemo(() => {
    const value = String(coord ?? '').trim()
    if (!value) return []
    const items: Array<{
      key: NavigationActionKind
      label: string
      url: string
      accessibilityLabel: string
    }> = [
      {
        key: 'google',
        label: NAVIGATION_ACTION_LABELS.google,
        url: buildGoogleMapsUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_google_maps_7f67f5c3'),
      },
      {
        key: 'apple',
        label: NAVIGATION_ACTION_LABELS.apple,
        url: buildAppleMapsUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_apple_maps_d4faa850'),
      },
      {
        key: 'organic',
        label: NAVIGATION_ACTION_LABELS.organic,
        url: buildOrganicMapsUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_organic_maps_2bec0c04'),
      },
      {
        key: 'waze',
        label: NAVIGATION_ACTION_LABELS.waze,
        url: buildWazeUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_waze_4f5d0468'),
      },
      {
        key: 'yandex-maps',
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        url: buildYandexMapsUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_yandeks_kartah_4a5a6174'),
      },
      {
        key: 'yandex',
        label: NAVIGATION_ACTION_LABELS.yandex,
        url: buildYandexNaviUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_yandeks_navigatore_13bec111'),
      },
      {
        key: 'osm',
        label: NAVIGATION_ACTION_LABELS.osm,
        url: buildOpenStreetMapUrl(value),
        accessibilityLabel: i18nT('navigation:components.navigation.PointNavigationMenu.otkryt_tochku_v_openstreetmap_3f6c4f7d'),
      },
    ]
    return items.filter((item) => item.url)
  }, [coord])

  if (actions.length === 0) return null

  return (
    <View style={styles.root} testID={testIDPrefix}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        testID={`${testIDPrefix}-toggle`}
        style={({ pressed }) => [styles.toggle, pressed && PRESSED_OPACITY]}
      >
        <Feather name={SEMANTIC_ACTION_ICON.navigationMenu} size={15} color={colors.primaryDark} />
        <Text style={styles.toggleText} numberOfLines={1}>{label}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
      </Pressable>

      {expanded ? (
        <View style={styles.actionGrid} testID={`${testIDPrefix}-actions`}>
          {actions.map((action) => {
            const visual = getNavigationActionVisual(action.key, colors)
            return (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                onPress={() => void openExternalUrlInNewTab(action.url)}
                testID={`${testIDPrefix}-${action.key}`}
                style={({ pressed }) => [styles.actionChip, pressed && PRESSED_OPACITY]}
              >
                <View style={[styles.actionIcon, { backgroundColor: visual.tintBg }]}>
                  <Feather name={visual.icon} size={14} color={visual.iconColor} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  root: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  toggle: {
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  toggleText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  actionChip: {
    minHeight: 34,
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  actionIcon: {
    width: 22,
    height: 22,
    borderRadius: DESIGN_TOKENS.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionLabel: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
  },
})
