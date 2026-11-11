import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import type { QuestMeta } from '@/screens/tabs/questsShared'
import type { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { getQuestCountryAlias } from '@/utils/questCountryLanding'
import { selectPopularQuests } from '@/utils/questPopularity'
import QuestEditorialText from './QuestEditorialText'
import { QUEST_LIST_ROUTE, QuestLandingGrid, QuestLandingScroll, QuestLandingSectionTitle } from './QuestLandingLayout'

const { spacing } = DESIGN_TOKENS

/** Сколько популярных квестов предложить вместо пустого экрана. */
export const QUEST_NOT_FOUND_POPULAR_LIMIT = 4
/** Страна по умолчанию для второй ссылки — лендинг Беларуси; alias тот же, что у маршрута (`BY → belarus`). */
export const QUEST_NOT_FOUND_COUNTRY_CODE = 'BY'
export const QUEST_NOT_FOUND_COUNTRY_ROUTE = `/quests/country/${getQuestCountryAlias(QUEST_NOT_FOUND_COUNTRY_CODE) ?? 'belarus'}`

type Props = {
  /**
   * Какая форма адреса не нашла свой сегмент: город или alias квеста
   * (`/quests/<slug>`), страна, либо сам квест (`/quests/<city>/<slug>` и адрес
   * с языковым префиксом, #3227).
   */
  kind: 'city' | 'country' | 'quest'
  /** Запрошенный сегмент адреса — показываем человеку, что именно не найдено. */
  segment: string
  /** Каталог квестов (может быть пустым, пока грузится): из него берутся популярные. */
  quests: readonly QuestMeta[]
  styles: ReturnType<typeof getStyles>
}

/**
 * Терминальный экран неизвестного адреса раздела квестов (#2896) — состояние
 * `not_found` общего контракта `utils/questAddressState.ts` (#3227). До него
 * `/quests/<неизвестный>` после гидратации оставался пустым: редирект в каталог
 * не доезжал, а клиентский запрос данных маршрута падал 404. Экран один для
 * города и страны: заголовок по виду лендинга, две ссылки (каталог и Беларусь)
 * и 3–4 популярных квеста, чтобы человек из битой ссылки не ушёл с пустоты.
 * Для роботов страница закрыта (`noindex, nofollow`): SSR-документ на этот
 * адрес сервер и так отдаёт кодом 404.
 */
export default function QuestNotFoundScreen({ kind, segment, quests, styles }: Props) {
  const colors = useThemedColors()
  const router = useRouter()
  const { isMobile } = useBreakpoints()
  const local = useMemo(() => createStyles(colors), [colors])
  const popular = useMemo(() => selectPopularQuests(quests as QuestMeta[], QUEST_NOT_FOUND_POPULAR_LIMIT), [quests])
  const hasCountryLanding = useMemo(
    () => quests.some((quest) => quest.countryCode === QUEST_NOT_FOUND_COUNTRY_CODE),
    [quests],
  )
  const title = i18nT(kind === 'country'
    ? 'quests:components.quests.QuestNotFoundScreen.countryTitle'
    : 'quests:components.quests.QuestNotFoundScreen.title')
  const screenTitle = i18nT('quests:components.quests.QuestNotFoundScreen.screenTitle')
  const screenOptions = useMemo(() => ({ title: screenTitle }), [screenTitle])

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <InstantSEO
        headKey="quest-not-found"
        title={i18nT('quests:components.quests.QuestNotFoundScreen.seoTitle')}
        description={i18nT('quests:components.quests.QuestNotFoundScreen.seoDescription')}
        robots="noindex, nofollow"
      />
      <QuestLandingScroll styles={styles} isMobile={isMobile}>
        <View style={local.block} testID="quest-not-found">
          <QuestEditorialText
            accessibilityRole="header"
            {...({ 'aria-level': 1 } as Record<string, unknown>)}
            style={local.title}
          >
            {title}
          </QuestEditorialText>
          <Text style={local.lead}>
            {i18nT('quests:components.quests.QuestNotFoundScreen.lead', { value1: segment })}
          </Text>
          <View style={local.actions}>
            <Button
              variant="primary"
              label={i18nT('quests:components.quests.QuestNotFoundScreen.allQuests')}
              onPress={() => router.replace(QUEST_LIST_ROUTE)}
              testID="quest-not-found-catalog"
            />
            {hasCountryLanding ? (
              <Button
                variant="outline"
                label={i18nT('quests:components.quests.QuestNotFoundScreen.belarus')}
                onPress={() => router.replace(QUEST_NOT_FOUND_COUNTRY_ROUTE as Parameters<typeof router.replace>[0])}
                testID="quest-not-found-country"
              />
            ) : null}
          </View>
        </View>
        {popular.length > 0 ? (
          <View style={local.block} testID="quest-not-found-popular">
            <QuestLandingSectionTitle colors={colors}>
              {i18nT('quests:components.quests.QuestNotFoundScreen.popularTitle')}
            </QuestLandingSectionTitle>
            <QuestLandingGrid styles={styles} quests={popular} />
          </View>
        ) : null}
      </QuestLandingScroll>
    </>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  block: {
    width: '100%',
    maxWidth: 840,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
})
