/**
 * #1461: на квесте `limassol-lionheart` блок «Экскурсии рядом» показывал
 * экскурсии по Минску — партнёрский виджет покрывает только Беларусь и на чужие
 * координаты молча подставляет свой город. Здесь работает НАСТОЯЩИЙ предикат
 * (в отличие от questWizardSections.belkraj.test.tsx, где он замокан флагом):
 * проверяем именно проводку `city.countryCode` в гейт.
 */
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

const MINSK = { name: 'Минск', lat: 53.9, lng: 27.56, countryCode: 'BY' }
const LIMASSOL = { name: 'Лимасол', lat: 34.7071, lng: 33.0226, countryCode: 'CY' }

describe('QuestExcursionsInline country gate', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('shows the partner widget for a Belarusian quest city', () => {
    const { getByTestId } = render(
      <QuestExcursionsInline colors={{}} styles={styles} city={MINSK} title="Квест по Минску" />,
    )

    expect(getByTestId('quest-belkraj-widget').props.countryCode).toBe('BY')
  })

  it('drops the widget — and the whole ghost card — outside Belarus', () => {
    const { queryByTestId, queryByText } = render(
      <QuestExcursionsInline colors={{}} styles={styles} city={LIMASSOL} title="Квест по Лимасолу" />,
    )

    expect(queryByTestId('quest-belkraj-widget')).toBeNull()
    expect(queryByTestId('quest-excursions-section')).toBeNull()
    expect(queryByText('Экскурсии рядом')).toBeNull()
  })

  it('drops the widget when only the coords say the city is abroad', () => {
    const { queryByTestId } = render(
      <QuestExcursionsInline
        colors={{}}
        styles={styles}
        city={{ name: 'Лимасол', lat: 34.7071, lng: 33.0226 }}
        title="Квест по Лимасолу"
      />,
    )

    expect(queryByTestId('quest-belkraj-widget')).toBeNull()
  })
})
