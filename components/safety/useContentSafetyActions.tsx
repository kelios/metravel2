// #2133 (Apple 1.2(c,d)): действия безопасности над любым чужим контентом.
//
// Хук отдаёт пункты для `ActionListSheet` и слой листа причины. Свой лист
// рисует `ContentSafetyActions` (кнопка «…»); экран, у которого лист действий уже
// есть (шапка чата, overflow шапки экрана), вливает те же пункты в него — второго
// меню на одном объекте не появляется.
//
// Блок — существующие `useBlockUser`/`useUnblockUser` и `confirmBlockUser`
// (#2134: подтверждение с последствиями, оптимистичный вырез из лент, откат).
// Пункт с последующим диалогом безопасен на iOS: `ActionListSheet` запускает его
// после закрытия своего Modal.

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import ReportReasonSheet from '@/components/safety/ReportReasonSheet'
import { useInsideHiddenContentGate } from '@/components/safety/HiddenContentGate'
import type { ActionListSheetItem } from '@/components/ui/ActionListSheet'
import { isMockBlocked, isMockReported } from '@/api/userSafety'
import { useHiddenContent } from '@/hooks/useHiddenContent'
import { useBlockUser, useUnblockUser } from '@/hooks/useUserSafety'
import { useAuthStore } from '@/stores/authStore'
import { CONTENT_SAFETY_POLICY, contentRefKey, toContentId, type ContentRef } from '@/types/contentSafety'
import { confirmBlockUser, confirmUnblockUser } from '@/utils/confirmUserBlock'
import { showToast } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'

export type ContentSafetyOptions = {
  contentRef: ContentRef | null
  /** Имя автора для диалога блокировки. */
  authorName?: string | null
  /** Начальные флаги профиля (BE: reported_by_me / is_blocked_by_me), только для `user`. */
  reportedByMe?: boolean
  isBlockedByMe?: boolean
  /** Префикс testID пунктов: `<prefix>-report|hide|block`. */
  testIDPrefix?: string
}

export type ContentSafetyActionsModel = {
  /** false — гость, свой контент или объект без id: меню не показывается. */
  available: boolean
  title: string
  items: ActionListSheetItem[]
  /** Есть ли среди пунктов блокировка — лист показывает её последствия. */
  hasBlock: boolean
  /** Слой листа причины; рендерить рядом с листом действий. */
  overlay: ReactNode
}

/**
 * Лёгкая проверка «показывать ли меню»: только стор сессии, без мутаций. Её зовёт
 * кнопка в каждой карточке ленты; полный хук монтируется после нажатия.
 */
export function useContentSafetyAvailable(contentRef: ContentRef | null): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const myId = toContentId(useAuthStore((s) => s.userId))
  if (!isAuthenticated || !contentRef) return false
  return myId === null || contentRef.author_id !== myId
}

export function useContentSafetyActions({
  contentRef,
  authorName,
  reportedByMe,
  isBlockedByMe,
  testIDPrefix = 'content-safety',
}: ContentSafetyOptions): ContentSafetyActionsModel {
  const available = useContentSafetyAvailable(contentRef)
  const hidden = useHiddenContent(contentRef)
  const insideGate = useInsideHiddenContentGate()
  const blockMutation = useBlockUser()
  const unblockMutation = useUnblockUser()

  const authorId = contentRef?.author_id ?? null
  const initialReported = () => !!reportedByMe || (contentRef ? isMockReported(contentRef) : false)
  const initialBlocked = () => !!isBlockedByMe || (authorId !== null && isMockBlocked(authorId))
  const [reportOpen, setReportOpen] = useState(false)
  const [reported, setReported] = useState(initialReported)
  const [blocked, setBlocked] = useState(initialBlocked)

  // Один экземпляр переживает смену объекта: слот FlashList каталога (ключ — позиция,
  // не id), листание fullscreen-галереи, другой диалог в desktop-split чата. Флаги
  // прошлого объекта на новом дали бы «Жалоба отправлена» без отправки.
  const refKey = contentRef ? contentRefKey(contentRef) : null
  const [stateKey, setStateKey] = useState(refKey)
  if (stateKey !== refKey) {
    setStateKey(refKey)
    setReportOpen(false)
    setReported(initialReported())
    setBlocked(initialBlocked())
  }

  // Флаги профиля патчатся и из других мест (баннер профиля, «Заблокированные», #2134).
  useEffect(() => {
    if (typeof isBlockedByMe === 'boolean') setBlocked(isBlockedByMe)
  }, [isBlockedByMe])
  useEffect(() => {
    if (reportedByMe) setReported(true)
  }, [reportedByMe])

  const blockAuthor = blockMutation.mutate
  const unblockAuthor = unblockMutation.mutate

  const runBlock = useCallback(async () => {
    if (authorId === null) return
    if (!(await confirmBlockUser(authorName))) return
    // Оптимистично, как и вырез контента в onMutate; ошибка возвращает состояние.
    setBlocked(true)
    blockAuthor(authorId, { onError: () => setBlocked(false) })
  }, [authorId, authorName, blockAuthor])

  const runUnblock = useCallback(async () => {
    if (authorId === null) return
    if (!(await confirmUnblockUser(authorName))) return
    setBlocked(false)
    unblockAuthor(authorId, { onError: () => setBlocked(true) })
  }, [authorId, authorName, unblockAuthor])

  const runHide = useCallback(() => {
    hidden.hide()
    void showToast({
      type: 'info',
      text1: i18nT('sharedStatic:contentSafety.hiddenToast'),
      action: { label: i18nT('sharedStatic:contentSafety.undo'), onPress: hidden.unhide },
    })
  }, [hidden])

  const policy = contentRef ? CONTENT_SAFETY_POLICY[contentRef.content_type] : null
  const isUser = contentRef?.content_type === 'user'

  const items: ActionListSheetItem[] = []
  if (available && contentRef && policy) {
    items.push({
      key: 'report',
      label: i18nT(reported ? 'sharedStatic:contentSafety.reported' : 'sharedStatic:contentSafety.report'),
      icon: 'flag',
      onPress: () => {
        if (reported) {
          void showToast({
            type: 'info',
            text1: i18nT('sharedStatic:contentSafety.reportAlreadySent'),
            text2: i18nT('sharedStatic:contentSafety.reportSla'),
          })
          return
        }
        setReportOpen(true)
      },
      testID: `${testIDPrefix}-report`,
    })
    if (policy.hideable && insideGate && hidden.canHide && !hidden.hidden) {
      items.push({
        key: 'hide',
        label: i18nT('sharedStatic:contentSafety.hide'),
        icon: 'eye-off',
        onPress: runHide,
        testID: `${testIDPrefix}-hide`,
      })
    }
    if (authorId !== null) {
      // Разблокировать можно только из профиля: в лентах контент заблокированного уже скрыт.
      if (isUser && blocked) {
        items.push({
          key: 'unblock',
          label: i18nT('sharedStatic:contentSafety.unblock'),
          icon: 'user-check',
          onPress: () => void runUnblock(),
          testID: `${testIDPrefix}-block`,
        })
      } else {
        items.push({
          key: 'block',
          label: i18nT(isUser ? 'sharedStatic:contentSafety.block' : 'sharedStatic:contentSafety.blockAuthor'),
          icon: 'slash',
          destructive: true,
          onPress: () => void runBlock(),
          testID: `${testIDPrefix}-block`,
        })
      }
    }
  }

  const overlay = available && contentRef ? (
    <ReportReasonSheet
      visible={reportOpen}
      target={contentRef}
      onClose={() => setReportOpen(false)}
      onReported={() => setReported(true)}
    />
  ) : null

  return {
    available,
    title: policy ? i18nT(policy.titleKey) : '',
    items,
    hasBlock: items.some((item) => item.key === 'block'),
    overlay,
  }
}
