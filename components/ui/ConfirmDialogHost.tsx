import React, { useCallback, useSyncExternalStore } from 'react'

import ConfirmDialog from '@/components/ui/ConfirmDialog'

import {
  getConfirmDialogRequest,
  resolveConfirmDialog,
  subscribeConfirmDialog,
} from './confirmDialogStore'

const getServerSnapshot = () => null

/**
 * Хост подтверждений: показывает дизайн-системный `ConfirmDialog` по запросу из
 * `confirmDialogStore` и возвращает ответ в промис `confirmAction`.
 *
 * Монтируется один раз в `RootWebDeferredChrome` — то есть на каждом web-маршруте
 * и только на web: на native подтверждение идёт через `Alert.alert` в самом
 * хелпере, поэтому подписка там не нужна.
 *
 * Пока запроса нет, компонент не рендерит ничего: `ConfirmDialog` при
 * недоступном `createPortal` (SSG, тесты) разворачивает `position: fixed`
 * подложку на весь экран, и держать её постоянно смонтированной на каждой
 * странице нельзя.
 */
const ConfirmDialogHost = () => {
  const request = useSyncExternalStore(
    subscribeConfirmDialog,
    getConfirmDialogRequest,
    getServerSnapshot,
  )

  const handleConfirm = useCallback(() => resolveConfirmDialog(true), [])
  const handleClose = useCallback(() => resolveConfirmDialog(false), [])

  if (!request) return null

  return (
    <ConfirmDialog
      visible
      title={request.title}
      message={request.message}
      confirmText={request.confirmText}
      cancelText={request.cancelText}
      onConfirm={handleConfirm}
      onClose={handleClose}
      confirmTestID="confirm-dialog-accept"
      cancelTestID="confirm-dialog-cancel"
    />
  )
}

export default ConfirmDialogHost
