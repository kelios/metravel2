import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { showToastMessage } from '@/utils/toast'
import { confirmAction } from '@/utils/confirmAction'
import { translate as i18nT } from '@/i18n'
import {
  describeTravelDeleteError,
  isTravelAlreadyDeletedError,
  removeTravelFromInfiniteTravelsCache,
} from '../ListTravelBase.helpers'

export interface UseListTravelDeleteReturn {
  deleteId: number | null
  deleteError: string | null
  /** Open the confirmation flow for a travel id. */
  requestDelete: (id: number) => void
  /** Confirm deletion of the currently targeted travel. */
  confirmDelete: () => void
  /** Dismiss the confirmation dialog and clear any error. */
  cancelDelete: () => void
}

export function useListTravelDelete(): UseListTravelDeleteReturn {
  const queryClient = useQueryClient()
  const deleteInFlightRef = useRef<number | null>(null)

  const [deleteId, setDelete] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (explicitId?: number) => {
      const targetId = explicitId ?? deleteId
      if (!targetId) return
      if (deleteInFlightRef.current === targetId) return
      deleteInFlightRef.current = targetId
      try {
        const { deleteTravel } = await import('@/api/travelsApi')
        await deleteTravel(String(targetId))
        removeTravelFromInfiniteTravelsCache(queryClient, targetId)
        setDelete(null)
        // Сбрасываем guard ТОЛЬКО после инвалидации: иначе повторный handleDelete(sameId)
        // в окне до завершения invalidate пройдёт и запустит второй deleteTravel (→ 404).
        await queryClient.invalidateQueries({ queryKey: queryKeys.travels() })
        deleteInFlightRef.current = null
        void showToastMessage({
          type: 'success',
          text1: i18nT('travel:components.listTravel.ListTravelBase.puteshestvie_udaleno_58ad42fe'),
        })
      } catch (error) {
        if (isTravelAlreadyDeletedError(error)) {
          removeTravelFromInfiniteTravelsCache(queryClient, targetId)
          setDelete(null)
          await queryClient.invalidateQueries({ queryKey: queryKeys.travels() })
          deleteInFlightRef.current = null
          return
        }

        deleteInFlightRef.current = null
        const { errorMessage, errorDetails } = describeTravelDeleteError(error)

        if (Platform.OS === 'web') {
          // Показываем ошибку в диалоге; он остаётся открытым чтобы пользователь мог попробовать снова
          setDeleteError(`${errorMessage}. ${errorDetails}`)
          return
        }
        // #2127: на native подтверждение — системный Alert, он уже закрыт; причина отказа — тостом.
        setDelete(null)
        void showToastMessage({ type: 'error', text1: errorMessage, text2: errorDetails, position: 'bottom' })
      }
    },
    [deleteId, queryClient],
  )

  // #2127: web — `ConfirmDialog` в ListTravelLayout (держит ошибку внутри и не
  // закрывается при отказе сервера); native — общий confirmAction (системный Alert).
  // Раньше native-вопрос показывал эффект по deleteId: закрытие Alert «Назад» на
  // Android оставляло deleteId, и повторное «Удалить» того же маршрута молчало.
  const requestDelete = useCallback(
    (id: number) => {
      setDeleteError(null)
      if (Platform.OS === 'web') {
        setDelete(id)
        return
      }
      void confirmAction({
        title: i18nT('travel:components.listTravel.ListTravelBase.udalit_puteshestvie_b9ed27f5'),
        message: i18nT('travel:components.listTravel.ListTravelBase.eto_deystvie_nelzya_otmenit_dd4f9ae8'),
        confirmText: i18nT('travel:components.listTravel.ListTravelBase.udalit_39199478'),
        cancelText: i18nT('travel:components.listTravel.ListTravelBase.otmena_b3f645ff'),
      }).then((confirmed) => {
        if (confirmed) void handleDelete(id)
      })
    },
    [handleDelete],
  )

  const confirmDelete = useCallback(() => {
    void handleDelete(deleteId ?? undefined)
  }, [handleDelete, deleteId])

  const cancelDelete = useCallback(() => {
    setDelete(null)
    setDeleteError(null)
  }, [])

  return {
    deleteId,
    deleteError,
    requestDelete,
    confirmDelete,
    cancelDelete,
  }
}
