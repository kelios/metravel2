// [FE-635 T3] Группировка маршрутов пользователя по стране (ISO alpha-2) для панели карты.
import { buildTravelsByCountryCode } from '@/components/screens/profile/profileCountries'
import type { Travel } from '@/types/types'

const travel = (id: number, countryName: string, name: string): Travel =>
  ({ id, countryName, name, title: name } as unknown as Travel)

describe('buildTravelsByCountryCode', () => {
  it('группирует маршруты по ISO-коду страны', () => {
    const map = buildTravelsByCountryCode([
      travel(1, 'Франция', 'Париж'),
      travel(2, 'Франция', 'Ницца'),
      travel(3, 'Беларусь', 'Минск'),
    ])

    expect(map.get('FR')?.map((t) => t.id).sort()).toEqual([1, 2])
    expect(map.get('BY')?.map((t) => t.id)).toEqual([3])
  })

  it('дедупит один и тот же маршрут по id внутри страны', () => {
    const map = buildTravelsByCountryCode([
      travel(7, 'Франция', 'Париж'),
      travel(7, 'Франция', 'Париж'),
    ])
    expect(map.get('FR')?.length).toBe(1)
  })

  it('пропускает маршруты без распознаваемой страны', () => {
    const map = buildTravelsByCountryCode([travel(1, '', 'Без страны')])
    expect(map.size).toBe(0)
  })
})
