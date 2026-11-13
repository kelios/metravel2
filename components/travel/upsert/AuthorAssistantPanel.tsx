/**
 * «Помощник автора» (#2885): панель на шаге публикации визарда статьи. Три кнопки —
 * заголовок, лид, SEO-описание — просят у `POST /ai/author-draft` варианты по тексту
 * описания; каждый вариант вставляется в своё поле кнопкой «Вставить». Панель живёт
 * только под `EXPO_PUBLIC_AI_ASSISTANT`: `PublishSeoCard` грузит её отложенным чанком
 * по литеральному флагу (#2738), без флага модуль в сборку не попадает и запросов к
 * `/ai/*` нет. Кнопки активны от `AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS` знаков текста.
 *
 * Состояния: idle → loading → variants | limit (429 limit) | unavailable (503, сеть,
 * таймаут `AUTHOR_DRAFT_TIMEOUT_MS`) — машина состояний и отмена запроса в `useAuthorDraft`
 * (общий с черновиком описания поездки, #2911). Один запрос за раз; уход со страницы отменяет его.
 */

import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS, type AiAuthorDraftKind } from '@/constants/aiFormPolicy'
import UIButton from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import { useAuthorDraft } from './useAuthorDraft'

export type AuthorAssistantPanelProps = {
  /** Плоский текст описания статьи — то, что читает модель. */
  text: string
  /** Вставка варианта в поле формы: `title` → название, `lead` → первый абзац описания, `meta` → SEO-описание. */
  onInsert: (kind: AiAuthorDraftKind, variant: string) => void
  testID?: string
}

/** Виды панели статьи; `trip` (#2911) живёт в планировщике поездки (`TripDescriptionDraftPanel`). */
type ArticleDraftKind = Exclude<AiAuthorDraftKind, 'trip'>

const KIND_META: Record<ArticleDraftKind, { icon: 'type' | 'align-left' | 'search'; labelKey: string; variantsKey: string }> = {
  title: { icon: 'type', labelKey: 'aiAssistStatic:author.suggestTitle', variantsKey: 'aiAssistStatic:author.variantsTitle' },
  lead: { icon: 'align-left', labelKey: 'aiAssistStatic:author.suggestLead', variantsKey: 'aiAssistStatic:author.variantsLead' },
  meta: { icon: 'search', labelKey: 'aiAssistStatic:author.suggestMeta', variantsKey: 'aiAssistStatic:author.variantsMeta' },
}

const KINDS: ArticleDraftKind[] = ['title', 'lead', 'meta']

function AuthorAssistantPanel({ text, onInsert, testID = 'author-assistant-panel' }: AuthorAssistantPanelProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createAuthorAssistantStyles(colors), [colors])
  const { state, suggest: requestVariants, loading } = useAuthorDraft(text)
  const [insertedKind, setInsertedKind] = useState<ArticleDraftKind | null>(null)
  // Панель запрашивает только виды статьи, поэтому `kind` состояния — один из них.
  const stateKind = 'kind' in state ? (state.kind as ArticleDraftKind) : null

  const textLength = text.trim().length
  const tooShort = textLength < AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS

  const suggest = useCallback(
    (kind: ArticleDraftKind) => {
      setInsertedKind(null)
      void requestVariants(kind)
    },
    [requestVariants],
  )

  const insert = useCallback(
    (kind: ArticleDraftKind, variant: string) => {
      onInsert(kind, variant)
      setInsertedKind(kind)
    },
    [onInsert],
  )

  return (
    <View style={styles.panel} testID={testID}>
      <View style={styles.headerRow}>
        <Feather name="edit-3" size={16} color={colors.primaryDark} />
        <Text style={styles.title}>{i18nT('aiAssistStatic:author.title')}</Text>
      </View>
      <Text style={styles.info}>{i18nT('aiAssistStatic:author.info')}</Text>

      <View style={styles.buttonsRow}>
        {KINDS.map((kind) => {
          const label = i18nT(KIND_META[kind].labelKey)
          return (
            <UIButton
              key={kind}
              label={label}
              accessibilityLabel={label}
              variant="soft"
              size="sm"
              icon={<Feather name={KIND_META[kind].icon} size={16} color={colors.primaryDark} />}
              disabled={tooShort || loading}
              loading={loading && stateKind === kind}
              onPress={() => suggest(kind)}
              testID={`author-assistant-suggest-${kind}`}
              style={styles.suggestButton}
            />
          )
        })}
      </View>

      {tooShort ? (
        <Text style={styles.hint} testID="author-assistant-too-short">
          {i18nT('aiAssistStatic:author.tooShort', { min: AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS, count: textLength })}
        </Text>
      ) : null}

      {state.status === 'loading' ? (
        <Text style={styles.hint} testID="author-assistant-loading">
          {i18nT('aiAssistStatic:author.loading')}
        </Text>
      ) : null}

      {state.status === 'limit' ? (
        <Text style={styles.error} testID="author-assistant-limit">
          {i18nT('aiAssistStatic:author.limit')}
        </Text>
      ) : null}

      {state.status === 'unavailable' ? (
        <Text style={styles.error} testID="author-assistant-unavailable">
          {i18nT('aiAssistStatic:author.unavailable')}
        </Text>
      ) : null}

      {state.status === 'variants' ? (
        <View style={styles.variants} testID="author-assistant-variants">
          <Text style={styles.variantsTitle}>{i18nT(KIND_META[stateKind ?? 'title'].variantsKey)}</Text>
          {state.variants.map((variant, index) => (
            <View key={`${state.kind}-${index}`} style={styles.variantRow}>
              <Text style={styles.variantText} selectable>
                {variant}
              </Text>
              <UIButton
                label={i18nT('aiAssistStatic:author.insert')}
                accessibilityLabel={i18nT('aiAssistStatic:author.insert')}
                variant="outline"
                size="sm"
                onPress={() => insert(stateKind ?? 'title', variant)}
                testID={`author-assistant-insert-${state.kind}-${index}`}
              />
            </View>
          ))}
          {insertedKind ? (
            <Text style={styles.success} testID="author-assistant-inserted">
              {i18nT(insertedKind === 'lead' ? 'aiAssistStatic:author.insertedLead' : 'aiAssistStatic:author.inserted')}
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

/** Стили панели помощника; черновик описания поездки (#2911) рисует варианты теми же. */
export const createAuthorAssistantStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    panel: {
      marginTop: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      color: colors.text,
    },
    info: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    // На 390 px три кнопки не влезают в ряд — переносятся; на 1440 стоят в линию.
    buttonsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    suggestButton: {
      flexGrow: 1,
    },
    hint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 18,
    },
    error: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.danger,
      lineHeight: 20,
    },
    success: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.successDark,
      lineHeight: 20,
    },
    variants: {
      gap: DESIGN_TOKENS.spacing.sm,
    },
    variantsTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
    variantRow: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    variantText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
  })

export default React.memo(AuthorAssistantPanel)
