/**
 * «Спросить про этот маршрут / квест» (#2897): контекстный вход в ассистента со
 * страницы статьи и квеста. Живёт только под `EXPO_PUBLIC_AI_ASSISTANT`: без флага
 * кнопки нет, страница не делает запросов к `/ai/*`, а `/assistant?source=…`
 * отдаёт «страница не найдена» (как и весь экран). Переход — `router.push`, ссылка
 * строится в `utils/aiAssistantConfig.ts`, чтобы не тянуть `api/aiAssist` в сборку
 * без флага (#2738).
 */

import React, { useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import UIButton from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { buildAssistantSourceHref, isAiAssistantEnabled, type AiAssistantSourceRef } from '@/utils/aiAssistantConfig'

type Props = {
  source: AiAssistantSourceRef
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

function AskAssistantButton({ source, fullWidth = false, style, testID = 'ask-assistant-source' }: Props) {
  const router = useRouter()
  const colors = useThemedColors()
  const onPress = useCallback(() => {
    router.push(buildAssistantSourceHref(source) as never)
  }, [router, source])

  if (!isAiAssistantEnabled()) return null
  const label = i18nT(source.type === 'quest' ? 'aiAssistStatic:ask.sourceCtaQuest' : 'aiAssistStatic:ask.sourceCtaTravel')
  return (
    <UIButton
      label={label}
      onPress={onPress}
      variant="soft"
      size="sm"
      fullWidth={fullWidth}
      icon={<Feather name="message-circle" size={16} color={colors.primaryDark} />}
      style={style}
      accessibilityLabel={label}
      testID={testID}
    />
  )
}

export default React.memo(AskAssistantButton)
