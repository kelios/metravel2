/**
 * #2148: шапка экрана прохождения квеста на телефоне — строка экрана (#2099)
 * вместо ряда меты и ряда кнопок над заданием. Порядок «⋯», состав листа (i) и
 * состояния офлайна — §12 `docs/features/mobile-screen-shell-mock.md`.
 *
 * Тест держит и сборку декларации (чистая функция), и проводку: строка экрана
 * действительно рисует объявленное, а пункт «⋯» действительно зовёт действие.
 */
import React from 'react'
import { Platform } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { usePathname, useRouter } from 'expo-router'

import HeaderContextBar from '@/components/layout/HeaderContextBar'
import { resetScreenHeaderForTests } from '@/components/layout/ScreenHeaderContext'
import QuestFontScaleSheet from '@/components/quests/QuestFontScaleSheet'
import {
  buildQuestScreenHeader,
  type QuestScreenHeaderInput,
  type QuestScreenMeta,
} from '@/components/quests/questScreenHeaderModel'
import { useQuestScreenHeader } from '@/components/quests/useQuestScreenHeader'
import { useQuestWizardResponsiveModel } from '@/components/quests/hooks/useQuestWizardResponsiveModel'
import { METRICS } from '@/constants/layout'
import { useQuestFontScaleStore } from '@/stores/questFontScaleStore'
import type { QuestCountModel } from '@/utils/questCountModel'

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react')
    React.useEffect(() => cb(), [cb])
  },
}))

jest.mock('@/hooks/useBreadcrumbModel', () => ({
  useBreadcrumbModel: () => ({
    showBreadcrumbs: true,
    pageContextTitle: 'Крошка',
    currentTitle: 'Крошка',
    backToPath: null,
    items: [{ label: 'Крошка', path: '/quests' }],
  }),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => (global as any).__mockResponsive,
}))

const explicitModel: QuestCountModel = {
  total: 12,
  start: 1,
  progressTotal: 11,
  required: 9,
  optional: 2,
  final: 1,
  source: 'explicit',
}

const fallbackModel: QuestCountModel = {
  total: 5,
  start: 1,
  progressTotal: 5,
  required: null,
  optional: null,
  final: null,
  source: 'fallback',
}

const handlers = () => ({
  onOfflineQuestDownload: jest.fn(),
  onOpenFontScale: jest.fn(),
  onPrint: jest.fn(),
  onOfflineMapDownload: jest.fn(),
  onOfflineMapOpenInApp: jest.fn(),
  onReset: jest.fn(),
})

const fullMeta = (overrides: Partial<QuestScreenMeta> = {}): QuestScreenMeta => ({
  isCompletedByMe: true,
  completionsCount: 12,
  rating: { count: 8, average: 4.62 },
  onOpenReviews: jest.fn(),
  onLeaveReview: jest.fn(),
  ...overrides,
})

const input = (overrides: Partial<QuestScreenHeaderInput> = {}): QuestScreenHeaderInput => ({
  title: 'Квест по Люксембургу',
  countModel: explicitModel,
  meta: fullMeta(),
  offlineQuestState: 'idle',
  canPrint: true,
  offlineMapPointsCount: 12,
  ...handlers(),
  ...overrides,
})

describe('buildQuestScreenHeader — декларация (#2148)', () => {
  it('«⋯» в порядке карточки, «Сбросить прогресс» последним и единственным destructive', () => {
    const header = buildQuestScreenHeader(input())
    const overflow = header.overflow ?? []

    expect(overflow.map((item) => item.key)).toEqual([
      'font-size',
      'print',
      'gpx',
      'maps',
      'reviews',
      'leave-review',
      'reset',
    ])
    expect(overflow.map((item) => item.label)).toEqual([
      'Размер шрифта',
      'Печать',
      'Скачать GPX',
      'Открыть в приложении',
      'Отзывы (8)',
      'Оставить отзыв',
      'Сбросить прогресс',
    ])
    expect(overflow.filter((item) => item.destructive).map((item) => item.key)).toEqual(['reset'])
  })

  it('недоступное не показывается: без печати, точек, отзывов и входа в отзыв — шрифт и сброс', () => {
    const header = buildQuestScreenHeader(
      input({
        canPrint: false,
        offlineMapPointsCount: 0,
        meta: fullMeta({
          isCompletedByMe: false,
          completionsCount: 0,
          rating: { count: 0, average: null },
          onOpenReviews: undefined,
          onLeaveReview: undefined,
        }),
      }),
    )

    expect((header.overflow ?? []).map((item) => item.key)).toEqual(['font-size', 'reset'])
  })

  it('пункт «Отзывы» требует и отзывы, и читалку', () => {
    const noReader = buildQuestScreenHeader(input({ meta: fullMeta({ onOpenReviews: undefined }) }))
    const noReviews = buildQuestScreenHeader(input({ meta: fullMeta({ rating: { count: 0, average: null } }) }))

    expect((noReader.overflow ?? []).some((item) => item.key === 'reviews')).toBe(false)
    expect((noReviews.overflow ?? []).some((item) => item.key === 'reviews')).toBe(false)
  })

  it('лист (i): статус, прохождения, рейтинг и разбивка точек', () => {
    const header = buildQuestScreenHeader(input())

    expect(header.title).toBe('Квест по Люксембургу')
    expect(header.info).toEqual([
      'Вы прошли этот квест',
      'Пройдено 12 раз',
      'Рейтинг 4,6 из 5 · 8 отзывов',
      'Маршрут: 12 · обязательные: 9 · по желанию: 2 · старт: 1 · финал: 1',
    ])
  })

  it('лист (i): ниже порога выборки (#1486) — только число отзывов; у квеста без ролей — число точек', () => {
    const header = buildQuestScreenHeader(
      input({
        countModel: fallbackModel,
        meta: fullMeta({ isCompletedByMe: false, completionsCount: 0, rating: { count: 2, average: 5 } }),
      }),
    )

    expect(header.info).toEqual(['2 отзыва', '5 точек'])
  })

  it('лист (i) есть всегда: у гостя без меты остаётся разбивка точек', () => {
    expect(buildQuestScreenHeader(input({ meta: undefined })).info).toEqual([
      'Маршрут: 12 · обязательные: 9 · по желанию: 2 · старт: 1 · финал: 1',
    ])
  })

  it('главное действие — офлайн в трёх состояниях, на время скачивания недоступно', () => {
    const idle = buildQuestScreenHeader(input({ offlineQuestState: 'idle' })).primaryAction
    const downloading = buildQuestScreenHeader(input({ offlineQuestState: 'downloading' })).primaryAction
    const done = buildQuestScreenHeader(input({ offlineQuestState: 'done' })).primaryAction

    expect(idle).toMatchObject({ icon: 'download-cloud', label: 'Скачать квест для офлайна', disabled: false })
    expect(downloading).toMatchObject({
      icon: 'download-cloud',
      label: 'Идёт сохранение квеста для офлайна',
      disabled: true,
    })
    expect(done).toMatchObject({ icon: 'check-circle', label: 'Квест сохранён для офлайна', disabled: false })
  })
})

const phone = { width: 390, height: 844, isPhone: true, isLargePhone: false, isDesktop: false, isMobile: true }

function QuestScreen({ props }: { props: Omit<QuestScreenHeaderInput, 'onOpenFontScale'> }) {
  const { fontScaleSheetOpen, closeFontScaleSheet } = useQuestScreenHeader(props)
  return <QuestFontScaleSheet visible={fontScaleSheetOpen} onClose={closeFontScaleSheet} />
}

const renderPhoneRow = (overrides: Partial<QuestScreenHeaderInput> = {}) => {
  const { onOpenFontScale: _ignored, ...props } = input(overrides)
  const view = render(
    <>
      <HeaderContextBar />
      <QuestScreen props={props} />
    </>,
  )
  return { ...view, props }
}

describe('useQuestScreenHeader — строка экрана на телефоне (#2148)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetScreenHeaderForTests()
    ;(usePathname as jest.Mock).mockReturnValue('/quests/117/luxembourg-melusina')
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true })
    ;(global as any).__mockResponsive = phone
    act(() => {
      useQuestFontScaleStore.setState({ fontScale: 1 })
    })
  })

  it('строка рисует название, (i), офлайн и «⋯»', () => {
    const { getByTestId } = renderPhoneRow()

    expect(getByTestId('screen-header-title').props.children).toBe('Квест по Люксембургу')
    expect(getByTestId('screen-header-info')).toBeTruthy()
    expect(getByTestId('quest-header-offline').props.accessibilityLabel).toBe('Скачать квест для офлайна')
    expect(getByTestId('screen-header-more')).toBeTruthy()
  })

  it('во время скачивания офлайн-кнопка недоступна, после — снова зовёт действие', () => {
    const busy = renderPhoneRow({ offlineQuestState: 'downloading' })
    expect(busy.getByTestId('quest-header-offline').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    )
    expect(busy.getByTestId('quest-header-offline')).toBeDisabled()
    busy.unmount()

    resetScreenHeaderForTests()
    const idle = renderPhoneRow({ offlineQuestState: 'idle' })
    expect(idle.getByTestId('quest-header-offline')).not.toBeDisabled()
    fireEvent.press(idle.getByTestId('quest-header-offline'))
    expect(idle.props.onOfflineQuestDownload).toHaveBeenCalledTimes(1)
  })

  it('«Сбросить прогресс» из «⋯» зовёт сброс визарда', async () => {
    const { getByTestId, props } = renderPhoneRow()

    fireEvent.press(getByTestId('screen-header-more'))
    fireEvent.press(getByTestId('quest-menu-reset'))

    // На iOS пункт листа выполняется после закрытия листа (onDismiss / таймер, #2115).
    await waitFor(() => expect(props.onReset).toHaveBeenCalledTimes(1))
  })

  it('«Размер шрифта» открывает лист с шагами, лист не закрывается на шаге', async () => {
    const { getByTestId } = renderPhoneRow()

    fireEvent.press(getByTestId('screen-header-more'))
    fireEvent.press(getByTestId('quest-menu-font-size'))

    await waitFor(() => expect(getByTestId('quest-font-scale-sheet')).toBeTruthy())
    expect(getByTestId('quest-font-scale-decrease').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    )

    fireEvent.press(getByTestId('quest-font-scale-increase'))
    fireEvent.press(getByTestId('quest-font-scale-increase'))

    expect(useQuestFontScaleStore.getState().fontScale).toBe(1.3)
    expect(getByTestId('quest-font-scale-sheet')).toBeTruthy()
    expect(getByTestId('quest-font-scale-increase').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    )
  })
})

const responsiveFor = (width: number) => ({
  width,
  height: 844,
  isPhone: width >= METRICS.breakpoints.phone && width < METRICS.breakpoints.largePhone,
  isLargePhone: width >= METRICS.breakpoints.largePhone && width < METRICS.breakpoints.tablet,
  isMobile: width < METRICS.breakpoints.tablet,
  isDesktop: width >= METRICS.breakpoints.desktop,
  isHydrated: true,
})

/**
 * Карточка, п. 2: порог «телефон» у панели визарда и у строки экрана — один. Иначе
 * на какой-то ширине пропали бы и кнопки панели, и строка (или нарисовались бы
 * обе). Проба рендерит строку экрана и визардную модель на одной ширине.
 */
describe('один порог «телефон» у панели и строки экрана (#2148)', () => {
  const WIDTHS = [320, 359, 390, 599, 600, 767, 768, 1024, 1279]

  function ParityProbe({ out }: { out: { headerInScreenRow?: boolean } }) {
    out.headerInScreenRow = useQuestWizardResponsiveModel().headerInScreenRow
    const { onOpenFontScale: _ignored, ...props } = input()
    useQuestScreenHeader(props)
    return null
  }

  it.each(['ios', 'android', 'web'] as const)('%s: «⋯» в строке ровно там, где панель отдала ей шапку', (os) => {
    const platform = jest.replaceProperty(Platform, 'OS', os)
    ;(usePathname as jest.Mock).mockReturnValue('/quests/117/luxembourg-melusina')
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true })
    try {
      for (const width of WIDTHS) {
        resetScreenHeaderForTests()
        ;(global as any).__mockResponsive = responsiveFor(width)
        const out: { headerInScreenRow?: boolean } = {}
        const view = render(
          <>
            <HeaderContextBar />
            <ParityProbe out={out} />
          </>,
        )
        expect([width, view.queryByTestId('screen-header-more') !== null]).toEqual([width, out.headerInScreenRow])
        expect([width, out.headerInScreenRow]).toEqual([width, width < METRICS.breakpoints.tablet])
        view.unmount()
      }
    } finally {
      platform.restore()
    }
  })
})

describe('quest short-height policy (#2198)', () => {
  const cases = [
    [320, 640, true], [390, 640, true], [390, 839, true],
    [390, 840, false], [390, 844, false],
    [599, 640, true], [600, 640, false], [1440, 640, false],
  ] as const

  function PlacementProbe({ out }: { out: { flow?: boolean } }) {
    out.flow = useQuestWizardResponsiveModel().headerInContentFlow
    return null
  }

  it.each(['web', 'android', 'ios'] as const)('%s uses the same layout-height boundary', (os) => {
    const platform = jest.replaceProperty(Platform, 'OS', os)
    try {
      for (const [width, height, expected] of cases) {
        ;(global as any).__mockResponsive = { ...responsiveFor(width), height }
        const out: { flow?: boolean } = {}
        const view = render(<PlacementProbe out={out} />)
        expect([width, height, out.flow]).toEqual([width, height, expected])
        view.unmount()
      }
    } finally {
      platform.restore()
    }
  })
})
