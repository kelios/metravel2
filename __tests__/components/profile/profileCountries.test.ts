import {
  buildCountryApplicationRows,
  buildProfileCountryStats,
  buildProfileCountryStatsFromProgress,
  normalizeCountryCatalog,
} from '@/components/screens/profile/profileCountries'
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

  it('builds stats from backend country-progress payload as the canonical source', () => {
    const stats = buildProfileCountryStatsFromProgress({
      total_count: 3,
      visited_count: 1,
      remaining_count: 2,
      countries: [
        {
          country_id: 1,
          country_code: 'BY',
          region: 'europe',
          title_ru: 'Беларусь',
          title_en: 'Belarus',
          visited: true,
          visited_travels_count: 2,
          first_visited_date: '2024-05-12',
          known_visit_dates_count: 1,
          unknown_visit_dates_count: 1,
          visits: [
            {
              travel_id: 10,
              travel_title: 'Минск на выходные',
              visited_date: '2024-05-12',
              date_precision: 'exact',
            },
          ],
        },
        {
          country_id: 2,
          country_code: 'US',
          region: 'north_america',
          title_ru: 'США',
          title_en: 'United States',
          visited: false,
        },
        {
          country_id: 3,
          country_code: 'BR',
          region: 'south_america',
          title_ru: 'Бразилия',
          title_en: 'Brazil',
          visited: false,
        },
      ],
    })

    expect(stats.totalCount).toBe(3)
    expect(stats.visitedCount).toBe(1)
    expect(stats.remainingCount).toBe(2)
    expect(stats.rows.find((country) => country.code === 'BY')).toMatchObject({
      visited: true,
      region: 'europe',
      source: 'backend',
      visitedTravelsCount: 2,
      firstVisitedDate: '2024-05-12',
      knownVisitDatesCount: 1,
      unknownVisitDatesCount: 1,
    })
    expect(stats.regionGroups.map((group) => group.key)).toEqual([
      'europe',
      'northAmerica',
      'southAmerica',
    ])
  })

  it('builds copy-friendly application rows from visited country progress', () => {
    const stats = buildProfileCountryStatsFromProgress({
      total_count: 2,
      visited_count: 1,
      remaining_count: 1,
      countries: [
        {
          country_id: 1,
          country_code: 'PL',
          region: 'europe',
          title_ru: 'Польша',
          title_en: 'Poland',
          visited: true,
          visited_travels_count: 2,
          first_visited_date: '2024-05-12',
          known_visit_dates_count: 1,
          unknown_visit_dates_count: 1,
          visits: [
            {
              travel_id: 101,
              travel_title: 'Варшава',
              start_date: '2024-05-12',
              end_date: '2024-05-14',
            },
          ],
        },
        {
          country_id: 2,
          country_code: 'DE',
          region: 'europe',
          title_ru: 'Германия',
          title_en: 'Germany',
          visited: false,
          visited_travels_count: 0,
          first_visited_date: null,
        },
      ],
    })

    expect(buildCountryApplicationRows(stats.rows)).toEqual([
      expect.objectContaining({
        name: 'Польша',
        code: 'PL',
        visitCount: 2,
        firstKnownDateLabel: '12 мая 2024',
        knownVisitDatesCount: 1,
        unknownVisitDatesCount: 1,
        visitLines: ['12 мая 2024 - 14 мая 2024: Варшава'],
        summaryText: 'Польша (PL); 2 раза; первая известная дата: 12 мая 2024',
      }),
    ])
  })
})
