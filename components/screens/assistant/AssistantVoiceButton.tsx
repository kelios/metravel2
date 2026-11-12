import { memo } from 'react'
import { Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import UIButton from '@/components/ui/Button'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import type { AssistantStyles } from './assistantStyles'
import type { AssistantVoiceNotice } from './useAssistantVoiceInput'

type AssistantVoiceButtonProps = {
  colors: ThemedColors
  listening: boolean
  disabled: boolean
  onPress: () => void
}

/** Кнопка диктовки вопроса (#3351): иконочная, как «Спросить», 44/48. */
function AssistantVoiceButtonComponent({ colors, listening, disabled, onPress }: AssistantVoiceButtonProps) {
  const label = listening ? i18nT('aiAssistStatic:ask.voiceStop') : i18nT('aiAssistStatic:ask.voiceStart')
  return (
    <UIButton
      iconOnly
      variant={listening ? 'danger' : 'outline'}
      label={label}
      accessibilityLabel={label}
      icon={<Feather name={listening ? 'square' : 'mic'} size={18} color={listening ? colors.textOnPrimary : colors.text} />}
      onPress={onPress}
      disabled={disabled}
      testID="assistant-voice"
    />
  )
}

export const AssistantVoiceButton = memo(AssistantVoiceButtonComponent)

type AssistantVoiceStatusProps = {
  styles: AssistantStyles
  listening: boolean
  interimText: string
  notice: AssistantVoiceNotice
}

// Прямые вызовы с литералом: страж ключей (`__tests__/i18n/resources.test.ts`) видит каждый.
const noticeText = (notice: Exclude<AssistantVoiceNotice, null>): string => {
  switch (notice) {
    case 'denied':
      return i18nT('aiAssistStatic:ask.voiceDenied')
    case 'langUnsupported':
      return i18nT('aiAssistStatic:ask.voiceLangUnsupported')
    case 'network':
      return i18nT('aiAssistStatic:ask.voiceNetwork')
  }
}

/** Строка состояния диктовки: причина сбоя или «Слушаю…» с промежуточным текстом. */
function AssistantVoiceStatusComponent({ styles, listening, interimText, notice }: AssistantVoiceStatusProps) {
  if (notice) {
    return (
      <Text style={styles.composerErrorText} testID="assistant-voice-status" accessibilityLiveRegion="polite">
        {noticeText(notice)}
      </Text>
    )
  }
  if (!listening) return null
  const interim = interimText.trim()
  const listeningText = i18nT('aiAssistStatic:ask.voiceListening')
  return (
    <Text style={styles.composerMetaText} testID="assistant-voice-status" accessibilityLiveRegion="polite">
      {interim ? `${listeningText} ${interim}` : listeningText}
    </Text>
  )
}

export const AssistantVoiceStatus = memo(AssistantVoiceStatusComponent)
