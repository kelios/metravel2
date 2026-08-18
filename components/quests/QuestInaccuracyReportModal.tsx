// components/quests/QuestInaccuracyReportModal.tsx
// Отчёт игрока о неточности в квесте (#1480).
//
// Уходит в тот же контракт обратной связи, что и форма на /contact и /about
// (`sendFeedback` → POST /api/feedback/): отдельного эндпоинта под жалобы на
// контент квеста нет, а заводить полдюжины полей ради него незачем — админу
// нужны те же три поля плюс адрес страницы, который мы дописываем сами.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import ConsentCheckbox from '@/components/legal/ConsentCheckbox'
import { sendFeedback } from '@/api/misc'
import { useAuthStore } from '@/stores/authStore'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { buildCanonicalUrl } from '@/utils/seo'
import { translate as i18nT } from '@/i18n'

const { spacing, radii } = DESIGN_TOKENS

type Props = {
  visible: boolean
  onClose: () => void
  /** Название квеста — уходит в тело письма и показывается игроку в шапке формы. */
  questTitle: string
  questId?: string
  cityId?: string
  /** Сообщение об успешной отправке показывает вызывающий (тост визарда). */
  onSent?: () => void
}

const isEmailValid = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

function QuestInaccuracyReportModal({ visible, onClose, questTitle, questId, cityId, onSent }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  // Стор напрямую, а не `useAuth`: модалка живёт внутри визарда квеста и не
  // должна требовать AuthProvider в дереве (в тестах его нет).
  const username = useAuthStore((state) => state.username)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Имя подставляем один раз за открытие: иначе очищенное игроком поле
  // возвращало бы себе значение из профиля на каждом ре-рендере.
  const namePrefilled = useRef(false)
  useEffect(() => {
    if (!visible) {
      namePrefilled.current = false
      return
    }
    if (namePrefilled.current) return
    namePrefilled.current = true
    if (username) setName(username)
  }, [username, visible])

  const questUrl = useMemo(
    () => (questId ? buildCanonicalUrl(`/quests/${cityId ?? ''}/${questId}`) : ''),
    [cityId, questId],
  )

  const handleClose = useCallback(() => {
    if (sending) return
    setError('')
    onClose()
  }, [onClose, sending])

  const handleSubmit = useCallback(() => {
    const reporterName = name.trim()
    if (!reporterName || !email.trim() || !message.trim()) {
      setError(i18nT('quests:components.quests.QuestInaccuracyReportModal.fillAllFields'))
      return
    }
    if (!isEmailValid(email)) {
      setError(i18nT('quests:components.quests.QuestInaccuracyReportModal.invalidEmail'))
      return
    }
    if (!agree) {
      setError(i18nT('home:components.about.ContactForm.nuzhno_soglasie_add49b70'))
      return
    }

    void (async () => {
      setSending(true)
      setError('')
      try {
        // Контекст квеста в теле письма: без него отчёт «здесь неверная дата»
        // неотличим от любого другого и требует переписки, чтобы понять, о чём он.
        const context = i18nT('quests:components.quests.QuestInaccuracyReportModal.reportContext', {
          value1: questTitle,
          value2: questUrl || '—',
        })
        await sendFeedback(reporterName, email.trim(), `${context}\n\n${message.trim()}`)
        setMessage('')
        setAgree(false)
        onSent?.()
        onClose()
      } catch (e: unknown) {
        setError(
          (e instanceof Error && e.message) ||
            i18nT('quests:components.quests.QuestInaccuracyReportModal.sendFailed'),
        )
      } finally {
        setSending(false)
      }
    })()
  }, [agree, email, message, name, onClose, onSent, questTitle, questUrl])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* Modal — отдельное окно: ни `softwareKeyboardLayoutMode` из app.json, ни
          useQuestKeyboardReveal визарда на него не действуют, поэтому на iOS
          клавиатура закрывала бы поле «Что не так» и кнопку отправки. Тот же
          приём, что у формы обратной связи на /contact. */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.overlay}
          onPress={handleClose}
          accessibilityLabel={i18nT('quests:components.quests.QuestInaccuracyReportModal.close')}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
            testID="quest-inaccuracy-report-modal"
          >
            <View style={styles.header}>
              <Text style={styles.title}>
                {i18nT('quests:components.quests.QuestInaccuracyReportModal.title')}
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={i18nT('quests:components.quests.QuestInaccuracyReportModal.close')}
                testID="quest-inaccuracy-report-close"
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <Text style={styles.questLine} numberOfLines={2}>
                {i18nT('quests:components.quests.QuestInaccuracyReportModal.questLine', { value1: questTitle })}
              </Text>

              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={i18nT('quests:components.quests.QuestInaccuracyReportModal.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoComplete="name"
                accessibilityLabel={i18nT('quests:components.quests.QuestInaccuracyReportModal.namePlaceholder')}
                testID="quest-inaccuracy-report-name"
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={i18nT('quests:components.quests.QuestInaccuracyReportModal.emailPlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                accessibilityLabel={i18nT('quests:components.quests.QuestInaccuracyReportModal.emailPlaceholder')}
                testID="quest-inaccuracy-report-email"
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder={i18nT('quests:components.quests.QuestInaccuracyReportModal.messagePlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel={i18nT('quests:components.quests.QuestInaccuracyReportModal.messagePlaceholder')}
                testID="quest-inaccuracy-report-message"
              />

              <ConsentCheckbox
                checked={agree}
                onToggle={setAgree}
                testID="quest-inaccuracy-report-consent"
                accessibilityLabel={i18nT('home:components.about.ContactForm.soglasen_na_obrabotku_personalnyh_dannyh_2823c5ba')}
              >
                {i18nT('home:components.about.ContactForm.soglasen_na_na_obrabotku_personalnyh_dannyh_ffa70353')}
              </ConsentCheckbox>

              {error ? (
                <Text style={styles.error} testID="quest-inaccuracy-report-error">
                  {error}
                </Text>
              ) : null}

              <View style={styles.actions}>
                {sending ? <ActivityIndicator color={colors.primaryDark} /> : null}
                <Button
                  label={i18nT('quests:components.quests.QuestInaccuracyReportModal.submit')}
                  onPress={handleSubmit}
                  variant="primary"
                  size="md"
                  disabled={sending}
                  testID="quest-inaccuracy-report-submit"
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    keyboardAvoider: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
    },
    // Метрики шита держим едиными со второй модалкой квеста —
    // `QuestReviewsModal`: игрок открывает обе с одного экрана.
    sheet: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '85%',
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 44,
      height: 44,
      minWidth: 44,
      minHeight: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    body: {
      // `flexGrow`, а не `flex`: когда клавиатура сжимает шит, контент должен
      // стать прокручиваемым, а не ужаться вместе с ним.
      flexGrow: 1,
      padding: spacing.md,
      gap: spacing.sm,
    },
    questLine: {
      fontSize: 13,
      color: colors.textMuted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      minHeight: 44,
      color: colors.text,
      backgroundColor: colors.background,
    },
    textarea: {
      minHeight: 110,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
  })

export default QuestInaccuracyReportModal
