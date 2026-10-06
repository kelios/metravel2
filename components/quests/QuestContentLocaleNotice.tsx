import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useQuestContentLocale } from '@/hooks/useQuestContentLocale'
import { useThemedColors } from '@/hooks/useTheme'
import { isSupportedLocale, translate as i18nT } from '@/i18n'
import { getLocaleDisplayName } from '@/i18n/localeLabels'

/**
 * Язык текста квеста, если он отличается от языка интерфейса (#2198), иначе
 * `null`. Перевод идёт волнами: непереведённый квест приходит на языке
 * источника, офлайн-копия — на языке, на котором её сохранили.
 */
export function useQuestForeignContentLocale(contentLocale: string | undefined): string | null {
  // Запрошенная локаль контента = язык интерфейса (#2197); хук живёт и вне
  // `LocaleProvider`, в отличие от `useLocale()`.
  const locale = useQuestContentLocale()
  const language = String(contentLocale || '').trim().toLowerCase().split(/[-_]/)[0]
  if (!language || language === locale) return null
  return language
}

type Props = {
  contentLocale: string | undefined
  /**
   * Одна строка для закреплённой части экрана на телефоне: короткая подпись на
   * экране, полный текст — подпись для диктора (как `QuestProgressPendingNotice`).
   */
  compact?: boolean
}

/**
 * Пометка «квест пока доступен на языке: …» на детали квеста. Живёт в тех же
 * слотах статусов, что и пометка неотправленного прохождения: на телефоне —
 * строка статусов над навигацией, на desktop — ряд под заголовком. Своего
 * отступа в шапке не добавляет (#2105).
 */
export default function QuestContentLocaleNotice({ contentLocale, compact = false }: Props) {
  const colors = useThemedColors()
  const language = useQuestForeignContentLocale(contentLocale)
  if (!language) return null

  // Название языка — из существующих `language.*`; локаль вне реестра
  // называется своим кодом, а не пропадает.
  const languageName = isSupportedLocale(language)
    ? getLocaleDisplayName(language)
    : language.toUpperCase()
  const label = i18nT('quests:components.quests.QuestContentLocaleNotice.availableIn', {
    language: languageName,
  })
  // На телефоне строка статусов — одна строка: короткая подпись влезает в 320
  // на всех языках, полная остаётся подписью для диктора.
  const shortLabel = i18nT('quests:components.quests.QuestContentLocaleNotice.availableInShort', {
    language: languageName,
  })

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      testID="quest-content-locale-notice"
    >
      <Feather name="globe" size={13} color={colors.textMuted} />
      <Text style={[styles.chipText, { color: colors.textMuted }]} numberOfLines={compact ? 1 : undefined}>
        {compact ? shortLabel : label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
})
