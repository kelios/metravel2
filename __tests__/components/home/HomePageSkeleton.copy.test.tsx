import React from 'react'
import { render } from '@testing-library/react-native'

import { HomePageSkeleton } from '@/components/home/HomePageSkeleton'
import { MOOD_CARDS } from '@/components/home/homeHeroContent'
import { homeGenerated1 } from '@/i18n/locales/ru/generated/home_01'
import { homeStaticResources } from '@/i18n/locales/ru/static/home_static'

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react')
    const { View } = require('react-native')
    return React.createElement(View, { testID: 'mock-image-card-media', ...props })
  },
}))

jest.mock('@/components/home/useHomeViewport', () => ({
  useHomeViewport: () => ({
    isSmallPhone: false,
    isPhone: true,
    isLargePhone: false,
    isTablet: false,
    isDesktop: false,
    width: 390,
  }),
}))

// Скелетон главной обязан показывать реальный первый экран, а не серые плашки:
// весь текст hero статичен и известен до ответа API. Плашки допустимы только
// там, где контент приходит из API (обложка недели, «Популярное»).
describe('HomePageSkeleton — реальные подписи первого экрана', () => {
  // Строки берутся из RU-каталога напрямую, а не через тот же i18nT-ключ, что
  // и компонент: иначе тест подтверждал бы сам себя и пропустил бы подмену
  // ключа на «правильный по типу, но не тот» (например web-плейсхолдер поиска
  // вместо нативного).
  const copy = {
    title: homeGenerated1['components.home.HomeHeroBookLayout.kuda_poehat_07cb7b59'],
    titleAccent: homeGenerated1['components.home.HomeHeroBookLayout.v_eti_vyhodnye_c69482dd'],
    subtitle:
      homeGenerated1['components.home.HomeHero.realnye_marshruty_po_belarusi_i_evrope_s_fot_9e18c02e'],
    // Нативный плейсхолдер короткий: HomeHeroSearchBar отдаёт длинный вариант
    // только на web (Platform.OS === 'web').
    searchPlaceholder: homeGenerated1['components.home.HomeHeroSearchBar.kuda_hotite_poehat_5f13aee9'],
    cta: homeGenerated1['components.home.HomeHeroBookLayout.smotret_marshruty_4a0b9a63'],
    // Бейдж карточки недели рендерит HomeHeroPopularSection, а не BookLayout.
    weekKicker: homeGenerated1['components.home.HomeHeroPopularSection.marshrut_nedeli_b1be152b'],
    moods: [
      homeStaticResources['components.home.homeHeroContent.u_vody_7c603574'],
      homeStaticResources['components.home.homeHeroContent.zamki_aec014c6'],
      homeStaticResources['components.home.homeHeroContent.ruiny_f6673a79'],
      homeStaticResources['components.home.homeHeroContent.hayking_3faa621d'],
      homeStaticResources['components.home.homeHeroContent.karta_do_60_km_23bb7996'],
    ],
  }

  it('рисует заголовок, подзаголовок, поиск, CTA и mood-чипы текстом', () => {
    const { getByText, queryByText } = render(<HomePageSkeleton />)

    expect(getByText(copy.title, { exact: false })).toBeTruthy()
    expect(getByText(copy.titleAccent)).toBeTruthy()
    expect(getByText(copy.subtitle)).toBeTruthy()
    expect(getByText(copy.searchPlaceholder)).toBeTruthy()
    expect(getByText(copy.cta)).toBeTruthy()
    expect(getByText(copy.weekKicker)).toBeTruthy()

    copy.moods.forEach((title) => {
      expect(getByText(title)).toBeTruthy()
    })

    // Контроль на заведомо отсутствующей строке: тест ловит именно наш текст,
    // а не любое совпадение.
    expect(queryByText('Такой строки в hero нет')).toBeNull()
  })

  // MOOD_CARDS — источник чипов и для скелетона, и для реального ряда:
  // список не должен разъезжаться с RU-каталогом.
  it('чипы совпадают с MOOD_CARDS реального hero', () => {
    expect(MOOD_CARDS.map((card) => card.title)).toEqual(copy.moods)
  })
})
