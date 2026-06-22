import { memo, useEffect, useMemo } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useMyCharacter, useUserCharacter } from '@/hooks/useGamification'
import { useAuthStore } from '@/stores/authStore'
import { trackCharacterBlockViewed } from '@/utils/gamificationAnalytics'
import CharacterPathChoice from '@/components/achievements/CharacterPathChoice'
import SectionState from '@/components/achievements/SectionState'
import {
  CharacterHeadIcon,
  InventoryLineIcon,
  type InventoryIconKey,
} from '@/components/achievements/GamificationIcons'
import type { CharacterDetail } from '@/api/gamification'

interface Props {
  /** userId — публичный профиль; не задан — собственный (выбор пути доступен). */
  userId?: string | number | null
  /** bare — без внешней карточки (шапка персонажа остаётся; контент для хаба наград). */
  bare?: boolean
  testID?: string
  style?: StyleProp<ViewStyle>
}

const INVENTORY_KEYS: readonly InventoryIconKey[] = [
  'collar',
  'backpack',
  'compass',
  'map',
  'medals',
  'cape',
]

const detailIcon = (slug: string): InventoryIconKey =>
  INVENTORY_KEYS.includes(slug as InventoryIconKey)
    ? (slug as InventoryIconKey)
    : 'medals'

/** Блок персонажа в профиле: уровень + визуальные детали + выбор пути. FE-character-profile. */
function CharacterProfileCard({ userId, bare = false, testID, style }: Props) {
  const colors = useThemedColors()
  const isOwn = userId == null
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const ownQuery = useMyCharacter()
  const userQuery = useUserCharacter(isOwn ? null : userId)
  const { data, isFetching, isError } = isOwn ? ownQuery : userQuery

  useEffect(() => {
    if (!data) return
    trackCharacterBlockViewed({
      context: isOwn ? 'own' : 'public',
      pendingChoice: data.pendingChoice,
    })
  }, [data, isOwn])

  const styles = useMemo(() => getStyles(colors), [colors])

  if (isError) return null
  if (isOwn && !isAuthenticated) return null
  // Не fetching и нет данных (disabled/idle/пусто) — секция необязательная.
  if (!isFetching && !data) return null

  return (
    <View style={[bare ? styles.bare : styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <CharacterHeadIcon slug={data?.pathSlug ?? null} size={44} />
        <View style={styles.headerBody}>
          <Text style={styles.name}>{data?.name ?? 'Персонаж'}</Text>
          <Text style={styles.meta}>
            {data ? `Уровень ${data.level}` : ''}
            {data?.pathName ? ` · ${data.pathName}` : ''}
          </Text>
        </View>
      </View>

      <SectionState isFetching={isFetching} hasData={data != null}>
        {data ? (
          <>
            <View style={styles.details}>
              {data.details.map((d: CharacterDetail) => (
                <View
                  key={d.slug}
                  style={[styles.detail, !d.unlocked && styles.detailLocked]}
                >
                  {d.unlocked ? (
                    <InventoryLineIcon
                      icon={detailIcon(d.slug)}
                      size={16}
                      color={colors.primary}
                    />
                  ) : (
                    <Feather name="lock" size={14} color={colors.textMuted} />
                  )}
                  <Text
                    style={[
                      styles.detailLabel,
                      !d.unlocked && styles.detailLabelLocked,
                    ]}
                    numberOfLines={1}
                  >
                    {d.name}
                  </Text>
                </View>
              ))}
            </View>

            {isOwn && data.pendingChoice ? (
              <CharacterPathChoice options={data.pathOptions} />
            ) : null}
          </>
        ) : null}
      </SectionState>
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.md,
    },
    bare: { gap: DESIGN_TOKENS.spacing.md },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    headerBody: { flex: 1, minWidth: 0 },
    name: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    meta: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    details: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    detail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    detailLocked: { opacity: 0.55 },
    detailLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600',
      color: colors.text,
    },
    detailLabelLocked: { color: colors.textMuted },
  })

export default memo(CharacterProfileCard)
