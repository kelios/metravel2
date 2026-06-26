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
  type NavigationActionKind,
} from './navigationActionMeta'

type PointNavigationMenuProps = {
  coord?: string | null
  label?: string
  testIDPrefix?: string
}

const PRESSED_OPACITY = { opacity: 0.72 } as const

export default function PointNavigationMenu({
  coord,
  label = 'Открыть в навигаторе',
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
        accessibilityLabel: 'Открыть точку в Google Maps',
      },
      {
        key: 'apple',
        label: NAVIGATION_ACTION_LABELS.apple,
        url: buildAppleMapsUrl(value),
        accessibilityLabel: 'Открыть точку в Apple Maps',
      },
      {
        key: 'organic',
        label: NAVIGATION_ACTION_LABELS.organic,
        url: buildOrganicMapsUrl(value),
        accessibilityLabel: 'Открыть точку в Organic Maps',
      },
      {
        key: 'waze',
        label: NAVIGATION_ACTION_LABELS.waze,
        url: buildWazeUrl(value),
        accessibilityLabel: 'Открыть точку в Waze',
      },
      {
        key: 'yandex-maps',
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        url: buildYandexMapsUrl(value),
        accessibilityLabel: 'Открыть точку в Яндекс Картах',
      },
      {
        key: 'yandex',
        label: NAVIGATION_ACTION_LABELS.yandex,
        url: buildYandexNaviUrl(value),
        accessibilityLabel: 'Открыть точку в Яндекс Навигаторе',
      },
      {
        key: 'osm',
        label: NAVIGATION_ACTION_LABELS.osm,
        url: buildOpenStreetMapUrl(value),
        accessibilityLabel: 'Открыть точку в OpenStreetMap',
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
        <Feather name="navigation" size={15} color={colors.primary} />
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
