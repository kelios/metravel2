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
import { translate as i18nT } from '@/i18n'


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

// Человекочитаемый статус детали снаряжения: надета / открыта / заблокирована
// (с указанием уровня разблокировки, если BE его отдал).
const detailStatusLabel = (d: CharacterDetail): string => {
  if (d.equipped) return i18nT('profile:components.achievements.CharacterProfileCard.nadeto_d5cdf6b4')
  if (d.unlocked) return i18nT('profile:components.achievements.CharacterProfileCard.otkryto_165b1817')
  return d.minLevel != null ? i18nT('profile:components.achievements.CharacterProfileCard.s_urovnya_value1_29011d9c', { value1: d.minLevel }) : i18nT('profile:components.achievements.CharacterProfileCard.zablokirovano_1bfff8ed')
}

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

  // Сырое имя ветки (Собачья/Лисья/…) показываем только при наличии стабильного
  // pathSlug. Так UI не зависит от локализованного дефолтного имени маппера.
  const rawBranch = data?.pathName ?? data?.name ?? null
  const branchName = data?.pathSlug && rawBranch?.trim() ? rawBranch : null

  if (isError) return null
  if (isOwn && !isAuthenticated) return null
  // Не fetching и нет данных (disabled/idle/пусто) — секция необязательная.
  if (!isFetching && !data) return null

  return (
    <View style={[bare ? styles.bare : styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <CharacterHeadIcon slug={data?.pathSlug ?? null} size={44} />
        <View style={styles.headerBody}>
          <Text style={styles.name}>
            {isOwn ? i18nT('profile:components.achievements.CharacterProfileCard.vash_personazh_1a70cf65') : i18nT('profile:components.achievements.CharacterProfileCard.personazh_puteshestvennika_d731c61d')}
          </Text>
          <Text style={styles.meta}>
            {branchName ? i18nT('profile:components.achievements.CharacterProfileCard.vetka_value1_66769f8f', { value1: branchName }) : ''}
            {branchName && data ? ' · ' : ''}
            {data ? i18nT('profile:components.achievements.CharacterProfileCard.uroven_value1_dc4881cc', { value1: data.level }) : ''}
          </Text>
          <Text style={styles.headerHint} numberOfLines={2}>
            {isOwn
              ? i18nT('profile:components.achievements.CharacterProfileCard.personazh_rastet_po_napravleniyam_aktivnosti_9da29bdc')
              : i18nT('profile:components.achievements.CharacterProfileCard.personazh_rastet_po_napravleniyam_aktivnosti_6be4f132')}
          </Text>
        </View>
      </View>

      <SectionState isFetching={isFetching} hasData={data != null}>
        {data ? (
          <>
            {data.details.length > 0 ? (
              <View style={styles.gearBlock}>
                <Text style={styles.gearTitle}>{i18nT('profile:components.achievements.CharacterProfileCard.snaryazhenie_personazha_0c1f2bd4')}</Text>
                <Text style={styles.gearHint}>{i18nT('profile:components.achievements.CharacterProfileCard.otkryvaetsya_po_mere_rosta_urovnya_024aa5aa')}</Text>
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
                          color={colors.primaryDark}
                        />
                      ) : (
                        <Feather name="lock" size={14} color={colors.textMuted} />
                      )}
                      <View style={styles.detailBody}>
                        <Text
                          style={[
                            styles.detailLabel,
                            !d.unlocked && styles.detailLabelLocked,
                          ]}
                          numberOfLines={1}
                        >
                          {d.name}
                        </Text>
                        <Text style={styles.detailStatus} numberOfLines={1}>
                          {detailStatusLabel(d)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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
    headerHint: {
      marginTop: 2,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      color: colors.textMuted,
    },
    gearBlock: { gap: 4 },
    gearTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    gearHint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    details: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: 2,
    },
    detail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: DESIGN_TOKENS.radii.md,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    detailLocked: { opacity: 0.55 },
    detailBody: { minWidth: 0 },
    detailLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600',
      color: colors.text,
    },
    detailLabelLocked: { color: colors.textMuted },
    detailStatus: {
      fontSize: 10,
      lineHeight: 12,
      color: colors.textMuted,
    },
  })

export default memo(CharacterProfileCard)
