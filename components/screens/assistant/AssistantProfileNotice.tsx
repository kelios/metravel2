/**
 * Строка «Ассистент учитывает ваши статьи и сохранённое» над полем вопроса (#3354). Показывается только
 * когда оба условия верны: посетитель вошёл и служба в последнем ходе подтвердила, что учла его сводку
 * (`done.profile`). До первого ответа и после выхода строки нет — экран не обещает того, чего служба не сделала.
 */

import { Text } from 'react-native'

import { translate as i18nT } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'

import type { AssistantStyles } from './assistantStyles'

export type AssistantProfileNoticeProps = {
  /** Служба подтвердила личный контекст в последнем ходе (`useAssistantChat().profileActive`). */
  confirmed: boolean
  styles: AssistantStyles
}

export function AssistantProfileNotice({ confirmed, styles }: AssistantProfileNoticeProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  if (!confirmed || !isAuthenticated) return null
  return (
    <Text style={styles.profileNotice} testID="assistant-profile-notice">
      {i18nT('aiAssistStatic:ask.profileNotice')}
    </Text>
  )
}
