import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { AI_SEARCH_MIN_QUERY_LENGTH, AI_SEARCH_MAX_QUERY_LENGTH } from '@/api/aiPicks'
import CardRail from '@/components/ui/CardRail'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { normalizeAiSearchQuery, useAiSearch } from '@/hooks/useAiPicks'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import { AiPickCard, AiPickCardSkeleton } from './AiPickCard'
import { AiSearchPanelFrame, useAiSearchPanelFrameStyles } from './AiSearchPanelFrame'

export const AI_SEARCH_DEBOUNCE_MS = 500
/** Слотов в каркасе ровно столько, сколько карточек видно в ряду до прокрутки. */
const SKELETON_SLOTS = 3
const RAIL_GAP = DESIGN_TOKENS.spacing.sm
const RAIL_SLOT_WIDTH = 280
const RAIL_SLOT_WIDTH_NARROW = 240

/**
 * «Подобрать по описанию» на `/search` (#2459): свободный вопрос → карточки статей и
 * квестов по смыслу с фрагментом «почему подошло». Результаты — один горизонтальный
 * ряд фиксированной высоты (как «Рядом»), поэтому каркас, карточки, пустой ответ и
 * отказ службы не двигают каталог под панелью. При отказе поле остаётся — обычный
 * поиск ниже работает, а другой запрос снова пробует службу.
 */
export function AiSearchPanel({ testID = 'ai-search-panel' }: { testID?: string }) {
  const colors = useThemedColors()
  const { isHydrated, isMobile } = useResponsive()
  const isNarrowLayout = isHydrated && isMobile
  const styles = useMemo(() => createStyles(colors, isNarrowLayout), [colors, isNarrowLayout])
  const frameStyles = useAiSearchPanelFrameStyles()
  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), AI_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value])

  const normalized = normalizeAiSearchQuery(debounced)
  const search = useAiSearch(normalized)

  const isActive = normalized.length >= AI_SEARCH_MIN_QUERY_LENGTH
  const isLoading = isActive && search.isFetching && !search.data
  const items = isActive ? search.data?.items ?? [] : []
  const showEmpty = isActive && !!search.data && items.length === 0
  const showUnavailable = isActive && search.isError
  const clear = () => {
    setValue('')
    setDebounced('')
  }

  return (
    <AiSearchPanelFrame
      testID={testID}
      inputRow={
        <>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={i18nT('aiPicksStatic:search.placeholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={i18nT('aiPicksStatic:search.inputLabel')}
            maxLength={AI_SEARCH_MAX_QUERY_LENGTH}
            returnKeyType="search"
            autoCorrect={false}
            style={frameStyles.input}
            testID="ai-search-input"
          />
          {value ? (
            <Pressable
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel={i18nT('aiPicksStatic:search.clear')}
              hitSlop={8}
              style={frameStyles.clearButton}
              testID="ai-search-clear"
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </>
      }
    >
      {isLoading ? (
        <View testID="ai-search-skeleton" accessibilityLabel={i18nT('aiPicksStatic:search.loading')}>
          <CardRail gap={RAIL_GAP} hideArrows contentPaddingVertical={4}>
            {Array.from({ length: SKELETON_SLOTS }, (_, index) => (
              <View key={`skeleton-${index}`} style={styles.slot}>
                <AiPickCardSkeleton showSnippet />
              </View>
            ))}
          </CardRail>
        </View>
      ) : null}

      {items.length > 0 ? (
        <View testID="ai-search-results">
          <Text style={styles.resultsTitle}>
            {i18nT('aiPicksStatic:search.resultsTitle')} · {items.length}
          </Text>
          {search.data?.degraded ? <Text style={styles.note}>{i18nT('aiPicksStatic:search.degraded')}</Text> : null}
          <CardRail gap={RAIL_GAP} contentPaddingVertical={4} accessibilityLabel={i18nT('aiPicksStatic:search.resultsTitle')}>
            {items.map((item) => (
              <View key={`${item.type}-${item.source_id}`} style={styles.slot}>
                <AiPickCard item={item} showSnippet slotWidth={isNarrowLayout ? RAIL_SLOT_WIDTH_NARROW : RAIL_SLOT_WIDTH} />
              </View>
            ))}
          </CardRail>
        </View>
      ) : null}

      {showEmpty ? (
        <Text style={styles.note} testID="ai-search-empty">
          {i18nT('aiPicksStatic:search.empty')}
        </Text>
      ) : null}

      {showUnavailable ? (
        <Text style={styles.note} testID="ai-search-unavailable">
          {i18nT('aiPicksStatic:search.unavailable')}
        </Text>
      ) : null}
    </AiSearchPanelFrame>
  )
}

function createStyles(colors: ThemedColors, isNarrowLayout: boolean) {
  return StyleSheet.create({
    resultsTitle: {
      marginTop: DESIGN_TOKENS.spacing.xxs,
      marginBottom: DESIGN_TOKENS.spacing.xxs,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    note: {
      marginTop: DESIGN_TOKENS.spacing.xxs,
      fontSize: 13,
      color: colors.textMuted,
    },
    slot: {
      width: isNarrowLayout ? RAIL_SLOT_WIDTH_NARROW : RAIL_SLOT_WIDTH,
    },
  })
}

export default React.memo(AiSearchPanel)
