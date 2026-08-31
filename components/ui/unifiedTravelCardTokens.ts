/**
 * Геометрия верхних слотов карточки маршрута (действия, админ-кнопки).
 *
 * Токены лежат отдельным модулем, а не рядом с `UnifiedTravelCard`, потому что
 * на web `TravelListItem` поднимает эти слоты ИЗ якоря карточки наружу (#1626:
 * интерактивный контент внутри `<a>` — невалидная вложенность и лишние
 * остановки Tab) и обязан повторить отступ карточки. Тесты повсеместно глушат
 * `@/components/ui/UnifiedTravelCard` фабрикой с одним `default`, и named-export
 * из компонента приезжал бы в `TravelListItem` как `undefined` — поднятые слоты
 * рисовались бы в тестах без отступа вовсе, а любая проверка их геометрии была
 * бы вакуумной.
 */
export const CARD_TOP_SLOT_INSET = 10
export const CARD_TOP_SLOT_Z_INDEX = 10

/**
 * Подъём карточки под курсором и его тайминг.
 *
 * Токен общий, потому что на web поднятые из якоря слоты карточке больше не
 * потомки: transform её контейнера на них не действует, и подъёмом обязана
 * владеть обёртка — иначе карточка уезжает вверх, оставляя кнопки на месте
 * (замерено: контейнер 340 → 329, кнопка 362 → 362).
 */
export const CARD_HOVER_LIFT_Y = -6
export const CARD_HOVER_LIFT_SCALE = 1.02
/** CSS-форма для карточки; обёртка берёт те же числа в RN-форме без каста. */
export const CARD_HOVER_LIFT_TRANSFORM = `translateY(${CARD_HOVER_LIFT_Y}px) scale(${CARD_HOVER_LIFT_SCALE})`
export const CARD_HOVER_TRANSITION = 'transform 0.2s ease'
