import React from 'react'

import HeartToggleButton from '@/components/travel/HeartToggleButton'
import { translate as i18nT } from '@/i18n'

/**
 * ♥ карточки места = сохранить ЭТУ точку в «Мои точки» (решение владельца
 * 08.11.2026). Раньше ♥ на фото места сохранял статью-источник, и все точки
 * одной статьи загорались разом. Переключатель — тот же, что у «Сохранить»
 * (`useSavedPointToggle` по координате), поэтому состояние своё у каждой точки.
 */
export type PlaceSaveHeart = {
  isSaved: boolean
  onToggle: () => void | Promise<void>
  /** Идёт запрос сохранения/удаления. */
  busy?: boolean
  /** Ещё не готовы auth или список «Моих точек». */
  disabled?: boolean
}

type Props = PlaceSaveHeart & {
  size?: number
  style?: any
}

function PlaceSaveHeartButton({ isSaved, onToggle, busy = false, disabled = false, size = 20, style }: Props) {
  return (
    <HeartToggleButton
      variant="overlay"
      active={isSaved}
      pending={busy}
      disabled={disabled}
      size={size}
      style={style}
      onPress={() => void onToggle()}
      overlayLabel={
        isSaved
          ? i18nT('map:components.places.PlaceSaveHeartButton.ubrat_iz_moi_tochki_d2e019db')
          : i18nT('map:components.places.PlaceSaveHeartButton.sohranit_v_moi_tochki_ba1cb5e1')
      }
      testID="place-save-heart"
    />
  )
}

export default React.memo(PlaceSaveHeartButton)
