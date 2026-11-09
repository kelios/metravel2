import React from 'react'
import { View } from 'react-native'

import EmptyState from '@/components/ui/EmptyState'
import { translate as i18nT } from '@/i18n'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'

import type { PointsListStyles } from './types'

type Props = {
  styles: PointsListStyles
  /** Загрузка не удалась — список пуст не потому, что точек нет. */
  loadFailed: boolean
  onRetry: () => void
  onAddPoint: () => void
}

/** Пустое состояние списка «Моих точек»: ошибка загрузки или «пока нет точек» (#3135: из `PointsList`). */
export const PointsListEmptyState: React.FC<Props> = ({ styles, loadFailed, onRetry, onAddPoint }) => {
  if (loadFailed) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          density="compact"
          icon="wifi-off"
          variant="error"
          title={i18nT('map:components.UserPoints.PointsList.ne_udalos_zagruzit_tochki_a1d1dfdc')}
          description={i18nT('map:components.UserPoints.PointsList.proverte_podklyuchenie_k_internetu_i_poprobu_e66933f1')}
          action={{ label: i18nT('map:components.UserPoints.PointsList.povtorit_0641a83c'), onPress: onRetry }}
        />
      </View>
    )
  }
  return (
    <View style={styles.emptyContainer} {...SCREEN_CONTENT_FIRST_PROPS}>
      <EmptyState
        density="compact"
        icon="map-pin"
        variant="empty"
        title={i18nT('map:components.UserPoints.PointsList.u_vas_poka_net_tochek_7f6af4ba')}
        description={i18nT('map:components.UserPoints.PointsList.sohranyayte_interesnye_mesta_na_karte_ili_do_04659fd5')}
        action={{ label: i18nT('map:components.UserPoints.PointsList.dobavit_tochku_c3c1a974'), onPress: onAddPoint }}
      />
    </View>
  )
}
