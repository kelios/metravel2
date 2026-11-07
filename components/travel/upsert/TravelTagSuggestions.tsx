/**
 * Блок «Предложено по тексту» (#2886) над полями шага «Дополнительно» визарда статьи:
 * чипы стран, категорий, транспорта, компаньонов и ночёвок, которые `POST /ai/suggest-tags`
 * подобрал по описанию (голосование ближайших статей индекса). Подписи — из словаря
 * `/getFiltersTravel/` на языке интерфейса (`filters`), уже выбранные значения не показываются.
 * Чип добавляет значение в поле формы, не снимая выбранного; «Принять все» — все поля разом;
 * «Скрыть» убирает блок до следующего монтирования. Пустой ответ, ошибка, деградация службы
 * или текст короче порога — блок не рендерится.
 *
 * Живёт только под `EXPO_PUBLIC_AI_PICKS`: `TravelWizardStepExtras` грузит его отложенным
 * чанком по литеральному флагу (#2738), без флага ни кода, ни запросов к `/ai/*` нет.
 */

import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { AI_TAG_SUGGEST_FIELDS, type AiTagSuggestField } from '@/api/aiAssist/policy'
import { isEmptyTagSuggestions } from '@/api/aiTagSuggestions'
import UIButton from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTravelTagSuggestions } from '@/hooks/useTravelTagSuggestions'
import { translate as i18nT } from '@/i18n'
import type { TravelFilters, TravelFormData } from '@/types/types'
import { trackWizardEvent } from '@/utils/analytics'
import { htmlToPlainText } from '@/utils/seoText'

export type TravelTagSuggestionsProps = {
  /** HTML описания статьи; в запрос уходит плоский текст. */
  description: string | null | undefined
  formData: Pick<TravelFormData, AiTagSuggestField>
  filters: TravelFilters | null
  /** Запись значения в поле формы — тот же `onFieldChange`, что у `FiltersUpsertComponent`. */
  onApply: (field: AiTagSuggestField, value: string[]) => void
  testID?: string
}

type Pending = { field: AiTagSuggestField; items: Array<{ id: string; label: string }> }

const FIELD_LABEL_KEYS: Record<AiTagSuggestField, string> = {
  countries: 'aiPicksStatic:tags.field.countries',
  categories: 'aiPicksStatic:tags.field.categories',
  transports: 'aiPicksStatic:tags.field.transports',
  companions: 'aiPicksStatic:tags.field.companions',
  over_nights_stay: 'aiPicksStatic:tags.field.over_nights_stay',
}

/** Подписи словаря по id: страны — `country_id`/`title_ru`, остальные — `id`/`name`; id бэка бывают числами. */
export function dictionaryLabels(filters: TravelFilters | null, field: AiTagSuggestField): Map<string, string> {
  const labels = new Map<string, string>()
  if (!filters) return labels
  if (field === 'countries') {
    for (const option of filters.countries ?? []) labels.set(String(option.country_id), option.title_ru)
    return labels
  }
  for (const option of filters[field] ?? []) labels.set(String(option.id), option.name)
  return labels
}

const selectedIds = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : [])

function TravelTagSuggestions({ description, formData, filters, onApply, testID = 'travel-tag-suggestions' }: TravelTagSuggestionsProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [dismissed, setDismissed] = useState(false)
  const plainText = useMemo(() => htmlToPlainText(description ?? ''), [description])
  const { data } = useTravelTagSuggestions(plainText, { enabled: !dismissed })

  const pending = useMemo<Pending[]>(() => {
    if (!data || data.degraded || isEmptyTagSuggestions(data)) return []
    const groups: Pending[] = []
    for (const field of AI_TAG_SUGGEST_FIELDS) {
      const labels = dictionaryLabels(filters, field)
      const selected = new Set(selectedIds(formData[field]))
      const items = data[field]
        .filter((id) => !selected.has(id) && labels.has(id))
        .map((id) => ({ id, label: labels.get(id) as string }))
      if (items.length) groups.push({ field, items })
    }
    return groups
  }, [data, filters, formData])

  const confidence = data?.confidence ?? 0

  const accept = useCallback(
    (field: AiTagSuggestField, ids: string[], mode: 'chip' | 'all') => {
      const current = selectedIds(formData[field])
      onApply(field, [...current, ...ids.filter((id) => !current.includes(id))])
      void trackWizardEvent('wizard_tag_suggestion_accepted', { field, values: ids.join(','), count: ids.length, mode, confidence })
    },
    [confidence, formData, onApply],
  )

  const acceptAll = useCallback(() => {
    for (const group of pending) accept(group.field, group.items.map((item) => item.id), 'all')
  }, [accept, pending])

  const dismiss = useCallback(() => {
    setDismissed(true)
    void trackWizardEvent('wizard_tag_suggestion_dismissed', {
      remaining: pending.reduce((sum, group) => sum + group.items.length, 0),
      confidence,
    })
  }, [confidence, pending])

  if (dismissed || !pending.length) return null

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Feather name="zap" size={16} color={colors.primary} />
        <Text style={styles.title}>{i18nT('aiPicksStatic:tags.title')}</Text>
      </View>
      <Text style={styles.hint}>{i18nT('aiPicksStatic:tags.hint')}</Text>
      {pending.map((group) => (
        <View key={group.field} style={styles.group} testID={`${testID}-${group.field}`}>
          <Text style={styles.fieldLabel}>{i18nT(FIELD_LABEL_KEYS[group.field])}</Text>
          <View style={styles.chips}>
            {group.items.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                icon={<Feather name="plus" size={14} color={colors.primaryText} />}
                onPress={() => accept(group.field, [item.id], 'chip')}
                testID={`${testID}-chip-${group.field}-${item.id}`}
              />
            ))}
          </View>
        </View>
      ))}
      <View style={styles.actions}>
        <UIButton
          label={i18nT('aiPicksStatic:tags.acceptAll')}
          variant="soft"
          size="sm"
          icon={<Feather name="check" size={16} color={colors.primaryText} />}
          onPress={acceptAll}
          testID={`${testID}-accept-all`}
        />
        <UIButton label={i18nT('aiPicksStatic:tags.dismiss')} variant="ghost" size="sm" onPress={dismiss} testID={`${testID}-dismiss`} />
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      marginBottom: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    hint: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 20,
      color: colors.textMuted,
    },
    group: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    fieldLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.textMuted,
    },
    // 390: чипы переносятся строками, а не уезжают за край.
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
  })

export default React.memo(TravelTagSuggestions)
