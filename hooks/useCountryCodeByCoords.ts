// hooks/useCountryCodeByCoords.ts
// Единственная async-граница таблицы контуров стран (#1543).
//
// `utils/geoCountry` тянет `utils/geoCountryOutlines` (67 КБ полигонов). Любой
// синхронный импорт из компонента, который лежит в стартовом графе маршрута,
// отправляет эту таблицу тегом <script> на страницу — так она и оказалась на
// travel-детали и на планировщике поездки (#1393, #1543).
//
// Резолв живёт здесь, а не по месту вызова, ровно по механизму Metro: чанки
// группируются по МНОЖЕСТВУ async-корней, из которых модуль достижим. Два
// отдельных `import('@/utils/geoCountry')` в двух компонентах — это два корня, и
// граф переразбивается при каждом новом потребителе; один чокпоинт — один
// корень, сколько бы компонентов его ни звало. Тот же канон, что у
// `utils/leafletVendor` (#765) и `utils/dropzoneVendor` (#1148).
import { useEffect, useState } from 'react'

export type LookupCoordinates = { lat: number; lng: number }

/**
 * ISO-код страны по координатам точки; `undefined`, пока таблица не догрузилась
 * или страна по координатам не резолвится.
 *
 * `enabled: false` — не грузить чанк вовсе (партнёрка выключена, код страны уже
 * известен явно). Ключ запроса держим вместе с результатом: пока координаты
 * сменились, а ответ по прежним ещё не пришёл, отдавать старую страну нельзя —
 * это увело бы партнёрскую ссылку не в ту страну.
 */
export const useCountryCodeByCoords = (
  coordinates: LookupCoordinates | undefined,
  enabled = true,
): string | undefined => {
  const lookupKey = coordinates ? `${coordinates.lat}|${coordinates.lng}` : 'none'
  const [derived, setDerived] = useState<{ key: string; code?: string }>({ key: '', code: undefined })

  useEffect(() => {
    if (!enabled || !coordinates) return

    let active = true
    void Promise.resolve(import('@/utils/geoCountry'))
      .then(({ getCountryCodeByCoords }) => {
        if (!active) return
        setDerived({ key: lookupKey, code: getCountryCodeByCoords(coordinates.lat, coordinates.lng) })
      })
      .catch(() => {
        // Чанк не догрузился — партнёрская ссылка остаётся нейтральной, блок живёт.
        if (active) setDerived({ key: lookupKey, code: undefined })
      })

    return () => {
      active = false
    }
  }, [coordinates, enabled, lookupKey])

  return derived.key === lookupKey ? derived.code : undefined
}

export default useCountryCodeByCoords
