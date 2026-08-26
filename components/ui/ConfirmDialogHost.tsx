import React, { Suspense, useCallback, useEffect, useSyncExternalStore } from 'react'

import { safeLazy } from '@/components/layout/safeLazy'

import {
  getConfirmDialogRequest,
  resolveConfirmDialog,
  subscribeConfirmDialog,
} from './confirmDialogStore'

const getServerSnapshot = () => null

const ConfirmDialogLoadFailure = () => {
  useEffect(() => {
    console.warn('ConfirmDialog не загрузился: подтверждение отклонено по умолчанию')
    resolveConfirmDialog(false)
  }, [])

  return null
}

const ConfirmDialogLazy = safeLazy(
  () => import('@/components/ui/ConfirmDialog'),
  'ConfirmDialog',
  { retries: 1, fallback: ConfirmDialogLoadFailure },
)

/**
 * Хост подтверждений: показывает дизайн-системный `ConfirmDialog` по запросу из
 * `confirmDialogStore` и возвращает ответ в промис `confirmAction`.
 *
 * Монтируется один раз в корневом layout — то есть на каждом web-маршруте и
 * только на web: на native подтверждение идёт через `Alert.alert` в самом
 * хелпере, поэтому подписка там не нужна.
 *
 * Пока запроса нет, компонент не рендерит и не загружает `ConfirmDialog`: eager
 * остаётся только лёгкая подписка, а UI-чанк появляется при первом запросе.
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
    <Suspense fallback={null}>
      <ConfirmDialogLazy
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
    </Suspense>
  )
}

export default ConfirmDialogHost
