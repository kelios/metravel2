import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('@/components/quests/questWizardMedia', () => ({
  BelkrajWidgetLazy: (props: Record<string, unknown>) => {
    const ReactModule = jest.requireActual('react') as typeof React
    const { View } = jest.requireActual('react-native') as typeof import('react-native')
    return ReactModule.createElement(View, { ...props, testID: 'quest-belkraj-widget' })
  },
  NativeQuestVideoLazy: () => null,
  QuestFullMapLazy: () => null,
  QuestWebVideo: () => null,
}))

import { QuestExcursionsInline } from '@/components/quests/questWizardSections'

const styles = {
  excursionsSection: {},
  excursionsDivider: {},
  excursionsCard: {},
  excursionsHeader: {},
  excursionsTitle: {},
  excursionsSubtitle: {},
}

describe('QuestExcursionsInline Belkraj integration', () => {
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
})
