import { translate as i18nT } from '@/i18n'
import { confirmAction } from '@/utils/confirmAction'

/**
 * Вопрос перед удалением точки маршрута в мастере статьи (#3214). Один текст для
 * списка точек, попапа маркера и окна редактирования: после ответа «Удалить»
 * автосохранение отправит статью без точки, и сервер удалит её вместе с фото.
 */
export function confirmRemoveRoutePoint(address?: string | null): Promise<boolean> {
  const label = (address ?? '').trim() || i18nT('map:components.map.EditMarkerModal.etu_tochku_054e1134')
  return confirmAction({
    title: i18nT('map:components.map.EditMarkerModal.udalit_tochku_b058b974'),
    message: i18nT('map:components.map.EditMarkerModal.udalit_tochku_value1_iz_marshruta_eto_deystv_229ad7bd', { value1: label }),
    confirmText: i18nT('common:action.delete'),
    cancelText: i18nT('common:action.cancel'),
  })
}
