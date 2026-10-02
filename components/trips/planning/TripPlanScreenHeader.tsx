// components/trips/planning/TripPlanScreenHeader.tsx
// #2101: декларация шапки экрана поездки. Правка владельца — иконка в строке экрана
// (primaryAction), остальное — пункты «⋯» (overflow): печать, экспорт, «Поделиться»,
// «Удалить поездку» последним и красным. Desktop эту декларацию не показывает:
// кнопки с подписями остаются в теле экрана. Компонент ничего не рисует и
// монтируется, только когда поездка загружена (хук геометрии печати требует trip).
import { useCallback } from 'react'
import { Platform } from 'react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import type { ActionListSheetItem } from '@/components/ui/ActionListSheet'
import { translate as i18nT } from '@/i18n'
import { shareTripPlan } from '@/utils/shareTripPlan'
import { trackRouteExported } from '@/utils/tripAnalytics'
import { printTripPlan } from './print/printTripPlan'
import { shouldRenderTripRouteExportMenu } from './tripRouteExport'
import { useTripRouteExportTrip } from './useTripRouteExportTrip'


type Props = {
  trip: PlannedTrip
  onEdit: () => void
  onDelete: () => void
  /** Открывает вкладку «Экспорт», где лежат GPX/KML и навигаторы. */
  onShowExport: () => void
  onActionError: (message: string | null) => void
}

export default function TripPlanScreenHeader({ trip, onEdit, onDelete, onShowExport, onActionError }: Props) {
  // Печать плана — окно браузера; в приложениях её нет до #2102, пункт скрыт (не disabled).
  const CAN_PRINT = Platform.OS === 'web'
  const { displayTrip } = useTripRouteExportTrip(trip, { enabled: CAN_PRINT })

  const handlePrint = useCallback(() => {
    onActionError(null)
    const printError = i18nT('trips:components.trips.planning.print.button.error')
    // printTripPlan открывает окно до первого await — вызов остаётся синхронным
    // продолжением нажатия на пункт.
    printTripPlan(displayTrip)
      .then((opened) => {
        if (opened) trackRouteExported(trip.id, 'print')
        else onActionError(printError)
      })
      .catch(() => onActionError(printError))
  }, [displayTrip, onActionError, trip.id])

  const handleShare = useCallback(() => {
    onActionError(null)
    void shareTripPlan(trip).then((result) => {
      if (result === 'unavailable') {
        onActionError(i18nT('trips:components.trips.planning.TripInvitePanel.ne_udalos_otkryt_menyu_podelitsya_poprobuyte_c9afbc63'))
      }
    })
  }, [onActionError, trip])

  const overflow: ActionListSheetItem[] = [
    ...(CAN_PRINT
      ? [{
          key: 'print',
          label: i18nT('trips:components.trips.planning.print.button.label'),
          icon: 'printer' as const,
          onPress: handlePrint,
          testID: 'trip-plan-menu-print',
        }]
      : []),
    ...(shouldRenderTripRouteExportMenu(Platform.OS)
      ? [{
          key: 'export',
          label: i18nT('tripsStatic:planner.actions.exportRoute'),
          icon: 'download' as const,
          onPress: onShowExport,
          testID: 'trip-plan-menu-export',
        }]
      : []),
    {
      key: 'share',
      label: i18nT('tripsStatic:planner.actions.share'),
      icon: 'share-2' as const,
      onPress: handleShare,
      testID: 'trip-plan-menu-share',
    },
    ...(trip.isOwner
      ? [{
          key: 'delete',
          label: i18nT('trips:app.tabs.trips.plan.id.udalit_poezdku_32f59a60'),
          icon: 'trash-2' as const,
          onPress: onDelete,
          destructive: true,
          testID: 'trip-plan-menu-delete',
        }]
      : []),
  ]

  useScreenHeader({
    title: trip.title,
    primaryAction: trip.isOwner
      ? {
          icon: 'edit-2',
          label: i18nT('trips:app.tabs.trips.plan.id.redaktirovat_poezdku_535ddda6'),
          onPress: onEdit,
          testID: 'trip-plan-edit',
        }
      : undefined,
    overflow,
  })

  return null
}
