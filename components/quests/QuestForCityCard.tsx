import React, { useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { useRichMediaVisibility } from '@/components/ui/richMediaViewport'
import NavigationIcon from '@/components/layout/NavigationIcon'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { formatDistance } from '@/utils/distanceCalculator'
import { getQuestAgeBadgeLabel, getQuestAgeCategory, isBikeQuest } from '@/utils/questAudience'
import { buildQuestPath } from '@/utils/routePaths'
import type { QuestMeta } from '@/utils/questAdapters'
import {
  QUEST_TILE_MEDIA_HEIGHT,
  QUEST_TILE_MEDIA_HEIGHT_COMPACT,
  QUEST_TILE_MEDIA_SIZE,
  QUEST_TILE_MEDIA_SIZE_COMPACT,
} from '@/components/quests/questCoverTileGeometry'
import {
  trackQuestCardClicked,
  trackQuestCardImpression,
} from '@/utils/growthFunnelAnalytics'
import { selectPlural, translate as i18nT } from '@/i18n'
import { formatInteger, formatNumber } from '@/i18n/format'

const createDifficultyLabels = (): Record<string, string> => ({
  easy: i18nT('quests:components.quests.QuestForCityCard.difficulty.easy'),
  medium: i18nT('quests:components.quests.QuestForCityCard.difficulty.medium'),
  hard: i18nT('quests:components.quests.QuestForCityCard.difficulty.hard'),
})

function formatPoints(points: number): string {
  return selectPlural(points, {
    one: i18nT('quests:components.quests.QuestForCityCard.value1_tochka_48728e6c', { value1: points }),
    few: i18nT('quests:components.quests.QuestForCityCard.value1_tochki_62e11867', { value1: points }),
    many: i18nT('quests:components.quests.QuestForCityCard.value1_tochek_eabc4aac', { value1: points }),
    other: i18nT('quests:components.quests.QuestForCityCard.value1_tochek_eabc4aac', { value1: points }),
  })
}

function formatDuration(durationMin: number): string {
  if (durationMin < 60) return i18nT('quests:components.quests.QuestForCityCard.value1_min_7d3797a3', { value1: formatInteger(durationMin) })
  const hours = durationMin / 60
  // #1459: дробный час печатает локаль — «1,5 ч», а не «1.5 ч».
  const rounded = formatNumber(hours, { maximumFractionDigits: 1 })
  return i18nT('quests:components.quests.QuestForCityCard.value1_ch_b656463e', { value1: rounded })
}

type Props = {
  quest: QuestMeta
  /** Надзаголовок над названием квеста */
  eyebrow?: string
  imageLoading?: 'lazy' | 'eager'
  style?: any
  analyticsSource?: string
  analyticsContextId?: string | number | null
  /**
   * Расстояние до квеста, км. Приходит от вызывающего, потому что точка
   * отсчёта у блоков разная: у «следующего квеста» (#1484) это только что
   * пройденный квест, а не пользователь.
   */
  distanceKm?: number | null
  /** Своё событие вызывающего; отправляется до перехода. */
  onPressCard?: () => void
}

/**
 * Карточка-CTA «Пройдите квест по этому городу» — перелинковка travel/главная → квест.
 * Ведёт на /quests/{cityId}/{quest_id}.
 */
export function QuestForCityCard({
  quest,
  eyebrow = i18nT('quests:components.quests.QuestForCityCard.gorodskoy_kvest_marshrut_90737ec7'),
  // #1115: дефолт был `eager`. `QuestForCitySection` на travel details рисует
  // рельс из шести таких карточек и ничего не передаёт — все шесть обложек
  // стартовали немедленно и конкурировали с LCP-фото статьи, находясь при этом
  // далеко ниже вьюпорта. Ленивая загрузка — правильный дефолт для рельса;
  // eager остаётся осознанным выбором вызывающего.
  imageLoading = 'lazy',
  style,
  analyticsSource = 'quest_card',
  analyticsContextId,
  distanceKm,
  onPressCard,
}: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  // #1673: карточка — горизонтальный ряд с квадратной плиткой 132 и стрелкой 40,
  // поэтому на 390pt тексту оставалось 148px и название резалось на второй строке
  // (замер: все шесть заголовков блока «Квесты по этому городу и рядом» требовали
  // четырёх строк). Ширина — та же величина, что решает раскладку, поэтому и
  // развилка по ней; `useBreakpoints` подписан только на ширину и не перерисовывает
  // карточку на скролле мобильного веба.
  //
  // Второй заход (прод-приёмка 01.09.2026): снятой стрелки не хватило. Замер прода
  // на 390pt — колонка 202px, `clientHeight` 69 при `scrollHeight` 92, то есть
  // лимит в три строки резал названия, которым нужно четыре. Их на выдаче 17 из
  // 165, и лечится это по-прежнему шириной: компактная плитка отдаёт заголовку
  // 238px, где ни одному названию выдачи не нужно больше трёх строк.
  //
  // `clientOnly` обязателен: без него первый кадр каждой карточки видит ширину 0 и
  // рисует узкий вариант. Замер на 1280 показал ровно это — шесть карточек
  // появлялись без стрелок и через ~50 мс дорисовывали их. Разметки карточки нет в
  // статическом HTML (секция лениво подгружается и ждёт данные квестов), поэтому
  // mismatch невозможен и ждать собственный commit незачем.
  const { isMobile, isPhone, isSmallPhone } = useBreakpoints({ clientOnly: true })
  // Телефон (<480pt) — единственная ширина, где плитка и текст спорят за строку:
  // на планшете и десктопе колонка и так шире, чем нужно самому длинному
  // названию выдачи. Поэтому компактная плитка включается именно здесь.
  const isNarrowColumn = isSmallPhone || isPhone
  const tileSize = isNarrowColumn ? QUEST_TILE_MEDIA_SIZE_COMPACT : QUEST_TILE_MEDIA_SIZE
  const tileHeight = isNarrowColumn ? QUEST_TILE_MEDIA_HEIGHT_COMPACT : QUEST_TILE_MEDIA_HEIGHT
  const styles = useMemo(() => createStyles(colors), [colors])
  const difficultyLabels = createDifficultyLabels()
  const mediaVisibility = useRichMediaVisibility(tileHeight)

  // #1185: карточка приходила и с пустым cityId/id, и шаблонная строка давала
  // `/quests/undefined/undefined` — клик уводил пользователя на 404.
  const href = buildQuestPath(quest.cityId, quest.id)
  const analyticsParams = useMemo(() => ({
    source: analyticsSource,
    questId: quest.id,
    cityId: quest.cityId,
    contextId: analyticsContextId,
  }), [analyticsContextId, analyticsSource, quest.cityId, quest.id])
  const impression = useTrackedImpression(
    `${analyticsSource}:${String(analyticsContextId ?? '')}:${String(quest.id)}`,
    useCallback(() => trackQuestCardImpression(analyticsParams), [analyticsParams]),
  )
  const handlePress = useCallback(() => {
    if (!href) return
    onPressCard?.()
    trackQuestCardClicked(analyticsParams)
    router.push(href as any)
  }, [analyticsParams, href, onPressCard, router])
  const chips: { key: string; icon: NavigationIconName; label: string }[] = []
  // Расстояние первым: в блоке «следующий квест рядом» именно оно отвечает на
  // вопрос «дойду ли я туда сейчас».
  if (typeof distanceKm === 'number' && Number.isFinite(distanceKm))
    chips.push({ key: 'distance', icon: 'navigation', label: formatDistance(distanceKm) })
  if (quest.points) chips.push({ key: 'points', icon: 'map-pin', label: formatPoints(quest.points) })
  if (quest.durationMin)
    chips.push({ key: 'duration', icon: 'clock', label: formatDuration(quest.durationMin) })
  const ageCategory = quest.ageCategory ?? getQuestAgeCategory(quest.tags)
  const ageBadgeLabel = getQuestAgeBadgeLabel(ageCategory)
  if (ageBadgeLabel) chips.push({ key: 'age', icon: 'users', label: ageBadgeLabel })
  if (isBikeQuest(quest.tags))
    chips.push({ key: 'bike', icon: 'bike', label: i18nT('quests:components.quests.QuestForCityCard.veloChip') })
  if (quest.difficulty && difficultyLabels[quest.difficulty])
    chips.push({
      key: 'difficulty',
      icon: 'bar-chart-2',
      label: difficultyLabels[quest.difficulty],
    })

  const cityLabel = quest.cityName ? i18nT('quests:components.quests.QuestForCityCard.po_gorodu_value1_2e44f93b', { value1: quest.cityName }) : i18nT('quests:components.quests.QuestForCityCard.po_etomu_gorodu_57c3bf25')
  const legacyCoverUri = typeof quest.cover === 'string' ? quest.cover.trim() : ''
  const squareSource = quest.squareCoverWebResponsiveSource
  const squareCoverUri = typeof squareSource?.src === 'string' ? squareSource.src.trim() : ''
  const coverUri = squareCoverUri || legacyCoverUri
  const squareWebResponsiveSource = mediaVisibility.visible && squareCoverUri && squareSource
    ? {
        ...squareSource,
        src: squareCoverUri,
        sizes: squareSource.sizes?.trim() || `${tileSize}px`,
      }
    : undefined

  return (
    <Pressable
      ref={impression.ref}
      onLayout={impression.onLayout}
      onPress={handlePress}
      style={({ pressed, hovered }: any) => [
        styles.card,
        style,
        (pressed || hovered) && styles.cardHover,
      ]}
      accessibilityRole={href ? 'link' : undefined}
      accessibilityState={href ? undefined : { disabled: true }}
      accessibilityLabel={i18nT('quests:components.quests.QuestForCityCard.proyti_kvest_value1_value2_54986608', { value1: cityLabel, value2: quest.title })}
    >
      <View
        ref={mediaVisibility.ref}
        onLayout={mediaVisibility.onLayout}
        collapsable={false}
        style={[styles.media, isNarrowColumn && styles.mediaCompact]}
        testID={`quest-card-media-viewport-${quest.id}`}
      >
        <ImageCardMedia
          source={mediaVisibility.visible && coverUri ? { uri: coverUri } : null}
          webResponsiveSource={squareWebResponsiveSource}
          width={tileSize}
          height={tileHeight}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          blurRadius={16}
          loading={imageLoading === 'eager' ? 'eager' : 'lazy'}
          // #1115: здесь стояли `optimizeWeb={false}` + `preserveOptimizedWebSrc`,
          // которые запрещали ImageCardMedia и ресайзить URL, и строить srcSet.
          // Плитка 132×132 из-за этого качала обложку ОРИГИНАЛОМ: замер DOM прода
          // 2026-07-28 — `naturalWidth` 1536 при CSS 132, вес 216–3003 КБ на файл.
          // Путь `/quest-cover/**` ресайз поддерживает (перепроверено после #1104):
          //   `?w=160&q=70&fit=cover` → 2 КБ, `?w=320` → 7.9 КБ, `?w=640` → 53 КБ.
          alt={i18nT('quests:components.quests.QuestForCityCard.oblozhka_kvesta_value1_28d57a5f', { value1: quest.title })}
          style={styles.image}
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text
          style={styles.title}
          // Лимит строк идёт за шириной колонки, потому что режет именно она.
          // Числа — потолок реальной выдачи, замеренный по всем 165 названиям
          // `/api/quests/?compact=1` в шрифте заголовка: 238px (390pt с
          // компактной плиткой) — 3 строки, 223px (375pt) — 4, 168px (320pt) —
          // 5. Верхняя граница остаётся страховкой от аномально длинного
          // названия, а не фиксированной высотой: короткому заголовку она
          // ничего не добавляет.
          numberOfLines={isSmallPhone ? 5 : isPhone ? 4 : isMobile ? 3 : 2}
          accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
          aria-level={3 as any}
        >
          {quest.title}
        </Text>
        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((chip, i) => (
              // Точка-разделитель живёт внутри группы с чипом, поэтому мета не
              // переносится «осиротевшим» «• Средне» на отдельную строку.
              <View key={chip.key} style={styles.chipGroup}>
                {i > 0 && <View style={styles.dot} />}
                <View style={styles.chip}>
                  <NavigationIcon name={chip.icon} size={13} color={colors.textMuted} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Стрелка — декоративная подсказка «это ссылка» для указателя: нажимается вся
          карточка, и на тач-экране она ничего не добавляет. На узкой колонке её
          40px вместе с отступом отдаются заголовку, ради которого заведён #1673. */}
      {isMobile ? null : (
        <View style={styles.arrow} testID="quest-card-arrow">
          <Feather name="arrow-right" size={18} color={colors.primary} />
        </View>
      )}
    </Pressable>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      gap: 14,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web'
        ? {
            cursor: 'pointer',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
          }
        : null),
    },
    cardHover: {
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
          transform: 'translateY(-2px)',
        } as any,
      }),
    },
    media: {
      width: QUEST_TILE_MEDIA_SIZE,
      height: QUEST_TILE_MEDIA_HEIGHT,
      flexShrink: 0,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    mediaCompact: {
      width: QUEST_TILE_MEDIA_SIZE_COMPACT,
      height: QUEST_TILE_MEDIA_HEIGHT_COMPACT,
    },
    image: { width: '100%', height: '100%' },
    body: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 6,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 23,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    chipGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: colors.textMuted,
      opacity: 0.6,
    },
    arrow: {
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
  })
}

export default React.memo(QuestForCityCard)
