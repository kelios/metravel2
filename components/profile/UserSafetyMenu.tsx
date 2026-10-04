// Меню «Пожаловаться / Заблокировать» на профиле и в списке участников поездки
// (FE-430). С #2133 — случай `user` общего `ContentSafetyActions`: та же жалоба
// (`POST /reports/`, content_type='user'), тот же блок с подтверждением (#2134).

import { memo, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import ContentSafetyActions from '@/components/safety/ContentSafetyActions'
import { makeContentRef } from '@/types/contentSafety'

interface Props {
  targetUserId: string | number
  targetName?: string
  /** Начальные флаги из профиля (BE: reported_by_me / is_blocked_by_me). */
  reportedByMe?: boolean
  isBlockedByMe?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

function UserSafetyMenu({ targetUserId, targetName, reportedByMe, isBlockedByMe, style, testID }: Props) {
  const contentRef = useMemo(() => makeContentRef('user', targetUserId, targetUserId), [targetUserId])
  return (
    <ContentSafetyActions
      contentRef={contentRef}
      authorName={targetName}
      reportedByMe={reportedByMe}
      isBlockedByMe={isBlockedByMe}
      appearance="surface"
      testIDPrefix="user-safety"
      testID={testID}
      style={style}
    />
  )
}

export default memo(UserSafetyMenu)
