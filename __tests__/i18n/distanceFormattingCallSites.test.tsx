/**
 * #1449: последние самодельные `toFixed(1)` для расстояния сведены к
 * каноническому форматтеру `utils/distanceCalculator`. Тесты держат две вещи:
 * пользовательский результат (разделители по локали на конкретных экранах) и
 * запрет на возврат собственного форматирования в эти файлы.
 */
import fs from 'node:fs'
import path from 'node:path'

import React from 'react'
import { render } from '@testing-library/react-native'
import { renderHook } from '@testing-library/react-native'

import { i18n } from '@/i18n'
import { resources } from '@/i18n/resources'

const mockMatches: Array<{ quest: any; distanceKm: number }> = []

jest.mock('@/hooks/useQuestForLocation', () => ({
  useQuestsForLocation: () => ({ matches: mockMatches }),
}))

const eyebrows: Array<string | undefined> = []
jest.mock('@/components/quests/QuestForCityCard', () => {
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ eyebrow }: { eyebrow?: string }) => {
      eyebrows.push(eyebrow)
      return <Text>{eyebrow ?? ''}</Text>
    },
  }
})

import { usePopupActions } from '@/components/MapPage/Map/PlacePopupCard/usePopupActions'
import QuestForCitySection from '@/components/travel/details/sections/QuestForCitySection'
import QuestCard from '@/screens/tabs/QuestCard'

const colors = { text: '#000', primary: '#000', background: '#fff' } as any

const drivingText = (meters: number, seconds: number) =>
  renderHook(() =>
    usePopupActions({
      colors,
      coord: '53.9,27.5',
      drivingDistanceMeters: meters,
      drivingDurationSeconds: seconds,
    }),
  ).result.current.drivingText

describe('#1449 расстояние на экранах идёт через канонический форматтер', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
    mockMatches.length = 0
    eyebrows.length = 0
  })

  describe('попап места на карте', () => {
    it.each([
      ['ru', '2,5 км', '1 200 км'],
      ['be', '2,5 км', '1200 км'],
      ['uk', '2,5 км', '1 200 км'],
      ['pl', '2,5 km', '1200 km'],
      ['en', '2.5 km', '1,200 km'],
    ] as const)('печатает расстояние поездки по нормам локали %s', async (locale, near, far) => {
      await i18n.changeLanguage(locale)

      // 2.5 км + 12 минут — короткая поездка, ETA остаётся рядом с расстоянием.
      expect(drivingText(2_500, 720)).toContain(near)
      // >1000 км: ETA снимается, остаётся только расстояние с разрядами локали.
      expect(drivingText(1_200_000, 60_000)).toBe(far)
    })
  })

  describe('карточка «квест для этого города» в статье', () => {
    const renderSection = (distanceKm: number, cityName?: string) => {
      mockMatches.push({ quest: { id: 1, cityName }, distanceKm })
      render(<QuestForCitySection travel={{ id: 7, cityName } as any} styles={{}} />)
      return eyebrows[eyebrows.length - 1]
    }

    it.each([
      ['ru', '~2,5 км · Минск', '~2,5 км рядом'],
      ['be', '~2,5 км · Минск', '~2,5 км побач'],
      ['uk', '~2,5 км · Минск', '~2,5 км поряд'],
      ['pl', '~2,5 km · Минск', '~2,5 km w pobliżu'],
      ['en', '~2.5 km · Минск', '~2.5 km nearby'],
    ] as const)('печатает подпись расстояния по нормам локали %s', async (locale, withCity, withoutCity) => {
      await i18n.changeLanguage(locale)

      expect(renderSection(2.5, 'Минск')).toBe(withCity)
      eyebrows.length = 0
      mockMatches.length = 0
      expect(renderSection(2.5)).toBe(withoutCity)
    })
  })

  describe('карточка квеста в каталоге «рядом»', () => {
    const renderCard = (distanceKm: number) => {
      const view = render(
        <QuestCard
          styles={{}}
          cardWidth={320}
          cityId="minsk"
          nearby
          quest={
            {
              id: 1,
              questId: 'minsk-cmok',
              title: 'Квест по центру Минска',
              points: 9,
              ratingAvg: 0,
              ratingCount: 0,
              _distanceKm: distanceKm,
            } as any
          }
        />,
      )
      return view
    }

    it.each([
      ['ru', '2,5 км', '750 м'],
      ['be', '2,5 км', '750 м'],
      ['uk', '2,5 км', '750 м'],
      ['pl', '2,5 km', '750 m'],
      ['en', '2.5 km', '750 m'],
    ] as const)('печатает расстояние до квеста по нормам локали %s', async (locale, km, m) => {
      await i18n.changeLanguage(locale)

      expect(renderCard(2.5).getByText(km)).toBeTruthy()
      expect(renderCard(0.75).getByText(m)).toBeTruthy()
    })
  })

  describe('регрессия: собственное форматирование не возвращается', () => {
    const CALL_SITES = [
      'components/MapPage/Map/PlacePopupCard/usePopupActions.ts',
      'components/quests/QuestFullMap.tsx',
      'components/quests/QuestFullMap.native.tsx',
      'components/quests/QuestPointNavigator.native.tsx',
      'components/settings/StravaSettingsSection.tsx',
      'components/travel/details/sections/QuestForCitySection.tsx',
      'screens/tabs/QuestCard.tsx',
    ]

    // Ловим только `toFixed` над расстоянием: координаты (`lat.toFixed(6)`) и
    // рейтинг квеста форматируются своими правилами и к этой задаче не относятся.
    const DISTANCE_TO_FIXED = /(?:\/\s*1000\s*\)|\b\w*(?:distance|dist|km|meters|metres)\w*\b[^\n]{0,20}?)\.toFixed/i

    it.each(CALL_SITES)('%s зовёт distanceCalculator и не собирает строку сам', (relative) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8')

      expect(source).toMatch(/from '@\/utils\/distanceCalculator'/)
      const selfMade = source
        .split('\n')
        .filter((line) => DISTANCE_TO_FIXED.test(line))
      expect({ file: relative, selfMade }).toEqual({ file: relative, selfMade: [] })
    })

    // Ключи вида «{{value1}} км» этих call-site осиротели вместе с правкой —
    // их возврат означал бы, что строку снова собирают на месте.
    const ORPHANED_KEYS: Array<[string, string]> = [
      ['map', 'components.MapPage.Map.PlacePopupCard.usePopupActions.value1_km_cbb88f64'],
      ['quests', 'components.quests.QuestFullMap.value1_km_e6f90e2a'],
      ['quests', 'components.quests.QuestFullMap.value1_m_fd529197'],
      ['quests', 'components.quests.QuestFullMap.value1_km_24d92f57'],
      ['quests', 'components.quests.QuestFullMap.value1_m_a64562c6'],
      ['quests', 'components.quests.QuestPointNavigator.value1_km_beba36b1'],
      ['quests', 'components.quests.QuestPointNavigator.value1_m_c15ed44c'],
      ['quests', 'screens.tabs.QuestCard.value1_km_9154fdca'],
      ['quests', 'screens.tabs.QuestCard.value1_m_b93b13fa'],
      ['profile', 'components.settings.StravaSettingsSection.value1_km_cb14e0a5'],
      ['profile', 'components.settings.StravaSettingsSection.value1_m_d2dbf1b0'],
      ['travel', 'components.travel.details.sections.QuestForCitySection.value1_km_value2_a298ad71'],
      ['travel', 'components.travel.details.sections.QuestForCitySection.value1_km_ryadom_4891f0e6'],
    ]

    it('не держит осиротевшие ключи расстояния ни в одной локали', () => {
      const survivors: string[] = []
      for (const locale of Object.keys(resources) as Array<keyof typeof resources>) {
        for (const [namespace, key] of ORPHANED_KEYS) {
          const entries = resources[locale][namespace as keyof (typeof resources)['ru']]
          if (entries && key in entries) survivors.push(`${locale}:${namespace}:${key}`)
        }
      }
      expect(survivors).toEqual([])
    })
  })
})
