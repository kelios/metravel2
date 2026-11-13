/**
 * «Черновик описания» поездки (#2911): кнопка под полем описания в планировщике
 * просит у `POST /ai/author-draft {kind: 'trip'}` 2–3 варианта по плоскому тексту
 * плана (`tripDraftText.ts`: точки по порядку, даты, транспорт). «Вставить» кладёт
 * вариант в пустое поле; непустое поле — кнопка «Заменить» и подтверждение
 * `confirmAction` (на web — `ConfirmDialog`, на native — системный Alert).
 * Состояния и отмена запроса — `useAuthorDraft`, стили вариантов —
 * `createAuthorAssistantStyles` (#2885). Модуль живёт под `EXPO_PUBLIC_AI_ASSISTANT`:
 * `TripPlanDescriptionEditor` грузит его отложенным чанком по литеральному флагу (#2738).
 */
import React, { useCallback, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS } from '@/constants/aiFormPolicy'
import { createAuthorAssistantStyles } from '@/components/travel/upsert/AuthorAssistantPanel'
import { useAuthorDraft } from '@/components/travel/upsert/useAuthorDraft'
import UIButton from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { confirmAction } from '@/utils/confirmAction'

export type TripDescriptionDraftPanelProps = {
  /** Плоский текст плана — `buildTripDraftText(trip)`. */
  planText: string
  /** Текущее описание: пустое — вставка без вопроса, иначе «Заменить» с подтверждением. */
  currentValue: string
  onInsert: (variant: string) => void
  disabled?: boolean
  testID?: string
}

function TripDescriptionDraftPanel({ planText, currentValue, onInsert, disabled = false, testID = 'trip-description-draft' }: TripDescriptionDraftPanelProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createAuthorAssistantStyles(colors), [colors])
  const { state, suggest, loading } = useAuthorDraft(planText)
  const [inserted, setInserted] = useState(false)

  const planLength = planText.trim().length
  const tooShort = planLength < AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS
  const hasText = currentValue.trim().length > 0

  const request = useCallback(() => {
    setInserted(false)
    void suggest('trip')
  }, [suggest])

  const insert = useCallback(
    async (variant: string) => {
      if (hasText) {
        const confirmed = await confirmAction({
          title: i18nT('aiAssistStatic:tripDraft.replaceTitle'),
          message: i18nT('aiAssistStatic:tripDraft.replaceMessage'),
          confirmText: i18nT('aiAssistStatic:tripDraft.replace'),
        })
        if (!confirmed) return
      }
      onInsert(variant)
      setInserted(true)
    },
    [hasText, onInsert],
  )

  const suggestLabel = i18nT('aiAssistStatic:tripDraft.suggest')
  const insertLabel = i18nT(hasText ? 'aiAssistStatic:tripDraft.replace' : 'aiAssistStatic:tripDraft.insert')

  return (
    <View style={styles.panel} testID={testID}>
      <View style={styles.headerRow}>
        <Feather name="edit-3" size={16} color={colors.primaryDark} />
        <Text style={styles.title}>{i18nT('aiAssistStatic:tripDraft.title')}</Text>
      </View>
      <Text style={styles.info}>{i18nT('aiAssistStatic:tripDraft.info')}</Text>

      <View style={styles.buttonsRow}>
        <UIButton
          label={suggestLabel}
          accessibilityLabel={suggestLabel}
          variant="soft"
          size="sm"
          icon={<Feather name="edit-3" size={16} color={colors.primaryDark} />}
          disabled={disabled || tooShort || loading}
          loading={loading}
          onPress={request}
          testID={`${testID}-suggest`}
          style={styles.suggestButton}
        />
      </View>

      {tooShort ? (
        <Text style={styles.hint} testID={`${testID}-too-short`}>
          {i18nT('aiAssistStatic:tripDraft.tooShort', { min: AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS, count: planLength })}
        </Text>
      ) : null}

      {state.status === 'loading' ? (
        <Text style={styles.hint} testID={`${testID}-loading`}>
          {i18nT('aiAssistStatic:author.loading')}
        </Text>
      ) : null}

      {state.status === 'limit' ? (
        <Text style={styles.error} testID={`${testID}-limit`}>
          {i18nT('aiAssistStatic:author.limit')}
        </Text>
      ) : null}

      {state.status === 'unavailable' ? (
        <Text style={styles.error} testID={`${testID}-unavailable`}>
          {i18nT('aiAssistStatic:author.unavailable')}
        </Text>
      ) : null}

      {state.status === 'variants' ? (
        <View style={styles.variants} testID={`${testID}-variants`}>
          <Text style={styles.variantsTitle}>{i18nT('aiAssistStatic:tripDraft.variantsTitle')}</Text>
          {state.variants.map((variant, index) => (
            <View key={`trip-${index}`} style={styles.variantRow}>
              <Text style={styles.variantText} selectable>
                {variant}
              </Text>
              <UIButton
                label={insertLabel}
                accessibilityLabel={insertLabel}
                variant="outline"
                size="sm"
                disabled={disabled}
                onPress={() => void insert(variant)}
                testID={`${testID}-insert-${index}`}
              />
            </View>
          ))}
          {inserted ? (
            <Text style={styles.success} testID={`${testID}-inserted`}>
              {i18nT('aiAssistStatic:tripDraft.inserted')}
            </Text>
          ) : null}
          {state.remaining != null ? (
            <Text style={styles.hint}>{i18nT('aiAssistStatic:author.remaining', { count: state.remaining })}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export default React.memo(TripDescriptionDraftPanel)
