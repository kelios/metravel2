import { memo, useCallback, useState } from 'react'
import { Platform, Text, TextInput, View, type TextInputKeyPressEvent } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { MAX_QUESTION_LENGTH } from '@/api/aiAssist/prompt'
import UIButton from '@/components/ui/Button'
import { usePrehydrationInputValue } from '@/hooks/usePrehydrationInputValue'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { ASSISTANT_INPUT_TEST_ID } from '@/utils/aiAssistantConfig'

import type { AssistantStyles } from './assistantStyles'
import { AssistantVoiceButton, AssistantVoiceStatus } from './AssistantVoiceButton'
import type { AssistantInputError } from './useAssistantChat'
import { useAssistantVoiceInput } from './useAssistantVoiceInput'

type AssistantComposerProps = {
  styles: AssistantStyles
  colors: ThemedColors
  busy: boolean
  remaining: number | null
  /** Третий вопрос не по теме за день (#2711): поле закрыто до завтра. */
  offTopicBlocked: boolean
  inputError: AssistantInputError
  /** Текст, подставленный извне (пример вопроса); сбрасывается после отправки. */
  draft: string
  onChangeDraft: (value: string) => void
  onSend: (question: string) => void
  onStop: () => void
}

function AssistantComposerComponent({
  styles,
  colors,
  busy,
  remaining,
  offTopicBlocked,
  inputError,
  draft,
  onChangeDraft,
  onSend,
  onStop,
}: AssistantComposerProps) {
  const [focused, setFocused] = useState(false)
  // Web: вопрос, набранный в статической разметке до гидрации, становится черновиком (#3346).
  usePrehydrationInputValue(ASSISTANT_INPUT_TEST_ID, draft, onChangeDraft)
  const limitReached = remaining !== null && remaining <= 0
  const canSend = !busy && !limitReached && !offTopicBlocked && draft.trim().length > 0
  // Голосовой ввод (#3351): диктовка дописывает фразу в черновик, отправляет вопрос человек.
  const voiceDisabled = busy || offTopicBlocked || limitReached
  const voice = useAssistantVoiceInput({ draft, onChangeDraft, disabled: voiceDisabled })

  const send = useCallback(() => {
    if (!canSend) return
    onSend(draft)
  }, [canSend, draft, onSend])

  // Enter отправляет, Shift+Enter переносит строку — только web, где есть
  // физическая клавиатура; на телефоне «Enter» многострочного поля — перенос.
  const onKeyPress = useCallback(
    (event: TextInputKeyPressEvent) => {
      if (Platform.OS !== 'web') return
      const native = event.nativeEvent as TextInputKeyPressEvent['nativeEvent'] & { shiftKey?: boolean }
      if (native.key === 'Enter' && !native.shiftKey) {
        event.preventDefault?.()
        send()
      }
    },
    [send],
  )

  let metaText: string | null = null
  let metaIsError = false
  if (offTopicBlocked || inputError === 'offTopicBlocked') {
    metaText = i18nT('aiAssistStatic:ask.blockedUntilTomorrow')
    metaIsError = true
  } else if (inputError === 'tooLong') {
    metaText = i18nT('aiAssistStatic:ask.tooLong', { max: MAX_QUESTION_LENGTH })
    metaIsError = true
  } else if (inputError === 'limit' || limitReached) {
    metaText = i18nT('aiAssistStatic:ask.limitReached')
    metaIsError = true
  } else if (remaining !== null) {
    metaText = i18nT('aiAssistStatic:ask.remaining', { count: remaining })
  }

  const sendLabel = i18nT('aiAssistStatic:ask.send')
  const stopLabel = i18nT('aiAssistStatic:ask.stop')

  return (
    <View style={styles.composerWrap} testID="assistant-composer">
      <View style={styles.composerRow}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          onKeyPress={onKeyPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={i18nT('aiAssistStatic:ask.placeholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_QUESTION_LENGTH}
          editable={!busy && !offTopicBlocked}
          returnKeyType="default"
          accessibilityLabel={i18nT('aiAssistStatic:ask.inputLabel')}
          style={[styles.input, inputError ? styles.inputError : null, focused ? { borderColor: colors.primary } : null]}
          testID={ASSISTANT_INPUT_TEST_ID}
        />
        {voice.available ? (
          <AssistantVoiceButton colors={colors} listening={voice.listening} disabled={voiceDisabled} onPress={voice.toggle} />
        ) : null}
        {busy ? (
          <UIButton
            iconOnly
            variant="outline"
            label={stopLabel}
            accessibilityLabel={stopLabel}
            icon={<Feather name="square" size={18} color={colors.text} />}
            onPress={onStop}
            testID="assistant-stop"
          />
        ) : (
          <UIButton
            iconOnly
            variant="primary"
            label={sendLabel}
            accessibilityLabel={sendLabel}
            icon={<Feather name="send" size={18} color={colors.textOnPrimary} />}
            onPress={send}
            disabled={!canSend}
            testID="assistant-send"
          />
        )}
      </View>
      {voice.listening || voice.notice ? (
        <View style={styles.composerMeta}>
          <AssistantVoiceStatus styles={styles} listening={voice.listening} interimText={voice.interimText} notice={voice.notice} />
        </View>
      ) : null}
      <View style={styles.composerMeta}>
        {metaText ? (
          <Text style={metaIsError ? styles.composerErrorText : styles.composerMetaText} testID="assistant-composer-meta">
            {metaText}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      <Text style={styles.disclaimer}>{i18nT('aiAssistStatic:ask.disclaimer')}</Text>
    </View>
  )
}

export const AssistantComposer = memo(AssistantComposerComponent)
