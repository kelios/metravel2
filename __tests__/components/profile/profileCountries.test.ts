import { buildProfileCountryStats, normalizeCountryCatalog } from '@/components/screens/profile/profileCountries'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'

describe('profileCountries', () => {
  it('marks visited countries by catalog id, ISO code and name aliases', () => {
    const countries = [
      { country_id: '1', title_ru: 'Польша', title_en: 'Poland', country_code: 'PL' },
      { country_id: '2', title_ru: 'Литва', title_en: 'Lithuania', country_code: 'LT' },
      { country_id: '3', title_ru: 'Беларусь', title_en: 'Belarus', country_code: 'BY' },
      { country_id: '4', title_ru: 'Германия', title_en: 'Germany', country_code: 'DE' },
      { country_id: '5', title_ru: 'Япония', title_en: 'Japan', country_code: 'JP' },
    ]

    const travels = [
      { id: 1, countryCode: 'PL', countryName: '' },
      { id: 2, countries: ['2'] },
    ] as unknown as Travel[]

    const personalTravelStatusEntries: TravelStatusEntry[] = [
      {
        id: 10,
        type: 'travel',
        title: 'Минск',
        url: '/travels/minsk',
        country: 'Беларусь',
        status: 'visited',
        addedAt: 1,
      },
      {
        id: 11,
        type: 'travel',
        title: 'Берлин',
        url: '/travels/berlin',
        country: 'Германия',
        status: 'wishlist',
        addedAt: 2,
      },
    ]

    const stats = buildProfileCountryStats({
      countries,
      travels,
      personalTravelStatusEntries,
    })

    expect(stats.visitedCount).toBe(3)
    expect(stats.remainingCount).toBe(2)
    expect(stats.rows.find((country) => country.name === 'Польша')?.visited).toBe(true)
    expect(stats.rows.find((country) => country.name === 'Литва')?.visited).toBe(true)
    expect(stats.rows.find((country) => country.name === 'Беларусь')?.visited).toBe(true)
    expect(stats.rows.find((country) => country.name === 'Германия')?.visited).toBe(false)
    expect(stats.rows.find((country) => country.name === 'Польша')?.region).toBe('europe')
    expect(stats.rows.find((country) => country.name === 'Япония')?.region).toBe('asia')
    expect(stats.regionGroups.map((group) => group.label)).toEqual(['Европа', 'Азия'])
    expect(stats.regionGroups.find((group) => group.key === 'europe')).toEqual(
      expect.objectContaining({
        totalCount: 4,
        visitedCount: 3,
        remainingCount: 1,
      }),
    )
  })

  it('keeps visited countries even when the country catalog is unavailable', () => {
    const stats = buildProfileCountryStats({
      countries: [],
      travels: [
        { id: 1, countryName: 'Грузия', countryCode: 'GE' },
      ] as unknown as Travel[],
      personalTravelStatusEntries: [],
    })

    expect(stats.totalCount).toBe(1)
    expect(stats.visitedCount).toBe(1)
    expect(stats.rows[0]).toEqual(
      expect.objectContaining({
        name: 'Грузия',
        code: 'GE',
        visited: true,
        source: 'visited',
      }),
    )
  })

  it('derives ISO codes and regions from localized country names when backend omits country_code', () => {
    const catalog = normalizeCountryCatalog([
      { country_id: 1, title_ru: 'Беларусь' },
      { country_id: 2, title_ru: 'Япония' },
      { country_id: 3, title_ru: 'Папуа - Новая Гвинея' },
    ])

    expect(catalog[0]).toMatchObject({ code: 'BY', region: 'europe' })
    expect(catalog[1]).toMatchObject({ code: 'JP', region: 'asia' })
    expect(catalog[2]).toMatchObject({ code: 'PG', region: 'oceania' })
  })
})
