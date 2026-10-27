// #2133: шаг причины жалобы — один лист для всех типов контента (профиль,
// путешествие, комментарий, сообщение, отзыв, фото). Подтверждение отправки —
// тост `useReportContent` со сроком модерации 24 ч.

import { memo, useMemo, useRef, useState } from 'react'
import {
  type ScrollViewInstance,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import BottomSheet from '@/components/ui/BottomSheet'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useReportContent, useReportReasons } from '@/hooks/useUserSafety'
import type { ReportReasonKey } from '@/api/userSafety'
import { reportReasonLabel } from '@/utils/reportReasonLabel'
import type { ContentRef } from '@/types/contentSafety'
import { translate as i18nT } from '@/i18n'

const COMMENT_MAX = 1000

type Props = {
  visible: boolean
  target: ContentRef
  onClose: () => void
  onReported?: () => void
}

function ReportReasonSheet({ visible, target, onClose, onReported }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const [reason, setReason] = useState<ReportReasonKey | null>(null)
  const [comment, setComment] = useState('')
  const bodyRef = useRef<ScrollViewInstance>(null)
  const commentFocused = useRef(false)

  // KAV/Android window resize shrink the body after focus. Keep the final field
  // in view again on that layout; no timer or second keyboard inset is needed.
  const revealComment = () => {
    if (commentFocused.current) bodyRef.current?.scrollToEnd({ animated: false })
  }

  const reasonsQuery = useReportReasons()
  const reportMutation = useReportContent()
  const reasons = reasonsQuery.data ?? []

  const close = () => {
    setReason(null)
    setComment('')
    commentFocused.current = false
    reportMutation.reset()
    onClose()
  }

  const submit = () => {
    if (!reason) return
    reportMutation.mutate(
      { target, reason, comment },
      {
        onSuccess: () => {
          onReported?.()
          close()
        },
      },
    )
  }

  const submitDisabled = !reason || reportMutation.isPending

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={i18nT('sharedStatic:contentSafety.reportTitle')}
      keyboardAware
      panelStyle={styles.panel}
    >
      <ScrollView
        ref={bodyRef}
        style={styles.body}
        onLayout={revealComment}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>{i18nT('sharedStatic:contentSafety.reason')}</Text>
        {reasonsQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : (
          reasons.map((r) => {
            const selected = reason === r.key
            const label = reportReasonLabel(r)
            return (
              <Pressable
                key={r.key}
                style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                onPress={() => setReason(r.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                testID={`report-reason-${r.key}`}
              >
                <Feather
                  name={selected ? 'check-circle' : 'circle'}
                  size={18}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{label}</Text>
              </Pressable>
            )
          })
        )}

        <Text style={styles.sectionLabel}>{i18nT('sharedStatic:contentSafety.commentLabel')}</Text>
        <TextInput
          value={comment}
          onChangeText={(t) => setComment(t.slice(0, COMMENT_MAX))}
          onFocus={() => { commentFocused.current = true; revealComment() }}
          onBlur={() => { commentFocused.current = false }}
          accessibilityLabel={i18nT('sharedStatic:contentSafety.commentLabel')}
          placeholder={i18nT('sharedStatic:contentSafety.commentPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.commentInput}
          testID="report-comment"
        />

        <Text style={styles.hint}>{i18nT('sharedStatic:contentSafety.reportSla')}</Text>

        {reportMutation.isError ? (
          <Text style={styles.error} testID="report-error" accessibilityRole="alert">
            {i18nT('sharedStatic:contentSafety.reportFailed')}
          </Text>
        ) : null}
      </ScrollView>
      <Pressable
        style={[styles.submitBtn, submitDisabled && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={submitDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitDisabled }}
        aria-disabled={submitDisabled}
        accessibilityLabel={i18nT('sharedStatic:contentSafety.submit')}
        testID="report-submit"
      >
        {reportMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.submitBtnText}>{i18nT('sharedStatic:contentSafety.submit')}</Text>
        )}
      </Pressable>
    </BottomSheet>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    panel: { maxHeight: '85%' },
    body: { flexShrink: 1 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: DESIGN_TOKENS.spacing.sm,
      marginBottom: 6,
    },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.lg, alignItems: 'center' },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 6,
    },
    reasonRowSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
    // flexShrink/flex у текста в row обязателен: на Android без него подпись усекается.
    reasonText: { flex: 1, fontSize: 14, color: colors.text },
    reasonTextSelected: { color: colors.primaryText, fontWeight: '600' },
    commentInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginTop: 8 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 8 },
    submitBtn: {
      marginTop: DESIGN_TOKENS.spacing.md,
      flexShrink: 0,
      minHeight: 44,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '700' },
  })

export default memo(ReportReasonSheet)
