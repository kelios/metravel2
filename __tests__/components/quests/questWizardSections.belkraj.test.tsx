import React from 'react'
import { render } from '@testing-library/react-native'

const mockQuestFullMapLazy = jest.fn(() => null)
let mockBelkrajRenderable = true

// Гейт рендера Belkraj открыт только в production-сборке; в jest управляем им явно.
jest.mock('@/components/belkraj/belkrajAvailability', () => ({
  ...(jest.requireActual('@/components/belkraj/belkrajAvailability') as object),
  isBelkrajEnabled: () => mockBelkrajRenderable,
  canRenderBelkrajWidget: () => mockBelkrajRenderable,
}))

jest.mock('@/components/quests/questWizardMedia', () => ({
  BelkrajWidgetLazy: (props: Record<string, unknown>) => {
    const ReactModule = jest.requireActual('react') as typeof React
    const { View } = jest.requireActual('react-native') as typeof import('react-native')
    return ReactModule.createElement(View, { ...props, testID: 'quest-belkraj-widget' })
  },
  NativeQuestVideoLazy: () => null,
  QuestFullMapLazy: (props: Record<string, unknown>) => mockQuestFullMapLazy(props),
  QuestWebVideo: () => null,
}))

import { QuestDesktopMapPanel, QuestExcursionsInline } from '@/components/quests/questWizardSections'

const styles = {
  excursionsSection: {},
  excursionsDivider: {},
  excursionsCard: {},
  excursionsHeader: {},
  excursionsTitle: {},
  excursionsSubtitle: {},
}

describe('QuestExcursionsInline Belkraj integration', () => {
  beforeEach(() => {
    mockBelkrajRenderable = true
  })

  it('passes the quest city coordinates to the shared Belkraj widget', () => {
    const city = {
      name: 'Минск',
      lat: 53.9,
      lng: 27.56,
      countryCode: 'BY',
    }

    const { getByTestId, getByText } = render(
      <QuestExcursionsInline
        colors={{}}
        styles={styles}
        city={city}
        title="Тест-квест"
      />,
    )

    const widget = getByTestId('quest-belkraj-widget')

    expect(getByText('Экскурсии рядом')).toBeTruthy()
    expect(widget.props.countryCode).toBe('BY')
    expect(widget.props.points).toEqual([
      { id: 1, address: 'Минск', lat: 53.9, lng: 27.56 },
    ])
  })

  // #1452: обвязка секции (разделитель + карточка + заголовок) рисовалась даже
  // тогда, когда виджет молча возвращал null — на экране оставалась пустая
  // карточка-призрак с одним заголовком «Экскурсии рядом».
  it('renders nothing when neither the widget nor affiliate offers have content', () => {
    mockBelkrajRenderable = false

    const { queryByText, queryByTestId } = render(
      <QuestExcursionsInline
        colors={{}}
        styles={styles}
        city={{ name: 'Минск', lat: 53.9, lng: 27.56, countryCode: 'BY' }}
        title="Тест-квест"
      />,
    )

    expect(queryByTestId('quest-excursions-section')).toBeNull()
    expect(queryByText('Экскурсии рядом')).toBeNull()
  })

  it('keeps exactly one «Экскурсии рядом» heading in the step-card section', () => {
    const { getAllByText } = render(
      <QuestExcursionsInline
        colors={{}}
        styles={styles}
        city={{ name: 'Минск', lat: 53.9, lng: 27.56, countryCode: 'BY' }}
        title="Тест-квест"
      />,
    )

    expect(getAllByText('Экскурсии рядом')).toHaveLength(1)
  })
})

describe('QuestDesktopMapPanel route classification', () => {
  const mapProps = {
    colors: {},
    styles: { fullMapSection: {} },
    currentStep: { id: 'intro', lat: 50.06, lng: 19.94 },
    steps: [
      { id: 'one', lat: 50.06, lng: 19.94 },
      { id: 'two', lat: 50.07, lng: 19.95 },
    ],
    compactDesktopLayout: false,
    useWideInlineLayout: false,
    desktopNavExpanded: false,
    setDesktopNavExpanded: jest.fn(),
    showMap: true,
    toggleMap: jest.fn(),
    openCurrentStepInMap: jest.fn(),
    copyCurrentStepCoords: jest.fn(),
  }

  beforeEach(() => {
    mockQuestFullMapLazy.mockClear()
  })

  it('does not build a pedestrian route while quest tags are still loading', () => {
    const { rerender } = render(<QuestDesktopMapPanel {...mapProps} />)

    expect(mockQuestFullMapLazy).not.toHaveBeenCalled()

    rerender(<QuestDesktopMapPanel {...mapProps} routeMode="bike" closeLoopRoute />)

    expect(mockQuestFullMapLazy).toHaveBeenCalledWith(
      expect.objectContaining({ routeMode: 'bike', closeLoop: true }),
    )
  })
})
