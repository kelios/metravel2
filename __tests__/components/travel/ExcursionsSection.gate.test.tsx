/**
 * Вторая половина инварианта #1452/#1460: секция «Экскурсии» на travel-details
 * рисует свою обвязку (заголовок + подзаголовок + карточка виджета) РОВНО тогда,
 * когда `canRenderBelkrajWidget` разрешает рендер виджета.
 *
 * Сторону пункта навигации закрывает `sectionLinks.test.ts`. Без этого файла
 * возврат к старому условию (проверка длины `travelAddress` вместо предиката или
 * потеря аргумента `countryCode`) вернул бы пустую карточку-призрак и не уронил
 * бы ни один тест: единственный тест, который вообще доходил до этой секции,
 * мокает её целиком (`TravelDetailsMapSection.test.tsx`).
 */
import React from 'react'
import { render } from '@testing-library/react-native'

let mockCanRenderBelkraj = true
const mockCanRenderBelkrajWidget = jest.fn(() => mockCanRenderBelkraj)

jest.mock('@/components/belkraj/belkrajAvailability', () => ({
  ...(jest.requireActual('@/components/belkraj/belkrajAvailability') as object),
  canRenderBelkrajWidget: (...args: unknown[]) => (mockCanRenderBelkrajWidget as any)(...args),
}))

jest.mock('@/components/belkraj/BelkrajWidget', () => {
  const ReactModule = jest.requireActual('react') as typeof React
  const { View } = jest.requireActual('react-native') as typeof import('react-native')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, { ...props, testID: 'travel-belkraj-widget' }),
  }
})

import { ExcursionsSection } from '@/components/travel/details/sections/ExcursionsSection'

const SECTION_TITLE = 'Экскурсии'

const styles = {
  sectionContainer: {},
  contentStable: {},
  webOptionalDeferredSection: {},
  sectionHeaderText: {},
  sectionSubtitle: {},
  excursionsWidgetCard: {},
} as any

const travel = {
  countryCode: 'BY',
  travelAddress: [{ id: 1, name: 'Минск', lat: 53.9, lng: 27.56 }],
} as any

const anchors = { excursions: React.createRef<any>() } as any

const renderSection = () => render(
  <ExcursionsSection
    travel={travel}
    anchors={anchors}
    styles={styles}
    shouldForceRenderExcursions={false}
  />,
)

beforeEach(() => {
  mockCanRenderBelkraj = true
  mockCanRenderBelkrajWidget.mockClear()
})

describe('ExcursionsSection: обвязка ходит за гейтом виджета', () => {
  // Виджет приезжает через React.lazy, поэтому первый кадр — Suspense-фолбэк;
  // ждём резолва, иначе тест проверял бы загрузчик, а не отрисованную секцию.
  it('рисует заголовок и виджет, когда гейт открыт', async () => {
    const { findByTestId, getByText } = renderSection()

    expect(await findByTestId('travel-belkraj-widget')).toBeTruthy()
    expect(getByText(SECTION_TITLE)).toBeTruthy()
  })

  it('не рисует ничего, когда виджет ничего не отдаст', () => {
    mockCanRenderBelkraj = false

    const { queryByText, queryByTestId } = renderSection()

    expect(queryByText(SECTION_TITLE)).toBeNull()
    expect(queryByTestId('travel-belkraj-widget')).toBeNull()
  })

  // Гейт обязан считаться по тем же данным, что уходят в виджет: иначе предикат
  // разойдётся с его поведением и вернётся карточка-призрак.
  it('спрашивает гейт теми же точками и countryCode, что получает виджет', () => {
    renderSection()

    expect(mockCanRenderBelkrajWidget).toHaveBeenCalledWith(
      travel.travelAddress,
      travel.countryCode,
    )
  })
})
