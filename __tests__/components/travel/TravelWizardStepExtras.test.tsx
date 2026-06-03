import React from 'react'
import { Text } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'

import TravelWizardStepExtras from '@/components/travel/TravelWizardStepExtras'
import type { TravelFormData, TravelFilters } from '@/types/types'

jest.mock('@/components/travel/TravelWizardHeader', () => (props: any) => {
  const { View, Text, Pressable } = require('react-native')
  return (
    <View testID="wizard-header-stub">
      <Text>{props.title}</Text>
      <Text>{`warnings:${props.warningCount}`}</Text>
      <Pressable accessibilityRole="button" onPress={props.onPrimary}>
        <Text>{props.primaryLabel}</Text>
      </Pressable>
    </View>
  )
})

// Surface the wrapping group's filled/total counts which the step computes itself.
jest.mock('@/components/travel/GroupedFiltersSection', () => (props: any) => {
  const { View, Text } = require('react-native')
  return (
    <View testID="grouped-filters">
      <Text>{props.group?.title}</Text>
      <Text>{`filled:${props.filledCount}/${props.totalCount}`}</Text>
      {props.children}
    </View>
  )
})

// Surface the flags the step passes and expose onFieldChange for behavior assertions.
jest.mock('@/components/travel/FiltersUpsertComponent', () => (props: any) => {
  const { View, Text, Pressable } = require('react-native')
  return (
    <View testID="filters-upsert">
      <Text>
        {JSON.stringify({
          showCategories: props.showCategories,
          showCountries: props.showCountries,
          showCoverImage: props.showCoverImage,
          showAdditionalFields: props.showAdditionalFields,
          showSaveButton: props.showSaveButton,
          isSuperAdmin: props.isSuperAdmin,
        })}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="set-budget"
        onPress={() => props.onFieldChange('budget', '1000')}
      >
        <Text>set-budget</Text>
      </Pressable>
    </View>
  )
})

jest.mock('@/components/travel/ValidationFeedback', () => ({
  ValidationSummary: (props: any) => {
    const { View, Text } = require('react-native')
    return (
      <View>
        <Text>{`summary-warnings:${props.warningCount}`}</Text>
      </View>
    )
  },
}))

jest.mock('@/hooks/useTheme', () => {
  const {
    MODERN_MATTE_PALETTE,
    MODERN_MATTE_SHADOWS,
    MODERN_MATTE_BOX_SHADOWS,
  } = require('@/constants/modernMattePalette')
  return {
    useThemedColors: () => ({
      ...MODERN_MATTE_PALETTE,
      shadows: MODERN_MATTE_SHADOWS,
      boxShadows: MODERN_MATTE_BOX_SHADOWS,
    }),
  }
})

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isPhone: false, isLargePhone: false }),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const baseFormData: TravelFormData = {
  id: '321',
  name: 'Test travel',
  countries: [],
  cities: [],
  over_nights_stay: [],
  complexity: [],
  companions: [],
  description: null,
  plus: null,
  minus: null,
  recommendation: null,
  youtube_link: null,
  gallery: [],
  categories: [],
  countryIds: [],
  travelAddressIds: [],
  travelAddressCity: [],
  travelAddressCountry: [],
  travelAddressAdress: [],
  travelAddressCategory: [],
  coordsMeTravel: [],
  thumbs200ForCollectionArr: [],
  travelImageThumbUrlArr: [],
  travelImageAddress: [],
  categoriesIds: [],
  transports: [],
  month: [],
  year: '',
  budget: '',
  number_peoples: '',
  number_days: '',
  visa: false,
  publish: false,
  moderation: false,
}

const emptyFilters: TravelFilters = {
  countries: [],
  categories: [],
  categoryTravelAddress: [],
  companion: [],
  complexity: [],
  month: [],
  over_nights_stay: [],
  transports: [],
} as unknown as TravelFilters

const renderStep = (override: Partial<TravelFormData> = {}, props: any = {}) => {
  const setFormData = jest.fn()
  const utils = render(
    <TravelWizardStepExtras
      currentStep={5}
      totalSteps={6}
      formData={{ ...baseFormData, ...override }}
      setFormData={setFormData}
      filters={emptyFilters}
      travelDataOld={null}
      isSuperAdmin={false}
      onManualSave={jest.fn()}
      onBack={jest.fn()}
      onNext={jest.fn()}
      {...props}
    />,
  )
  return { ...utils, setFormData }
}

describe('TravelWizardStepExtras (Шаг 5)', () => {
  it('renders the grouped filters section with its title and the filters component', () => {
    const { getByTestId, getByText } = renderStep()

    expect(getByTestId('grouped-filters')).toBeTruthy()
    expect(getByTestId('filters-upsert')).toBeTruthy()
    expect(getByText('Дополнительные параметры')).toBeTruthy()
  })

  it('passes the expected display flags to FiltersUpsertComponent', () => {
    const { getByTestId } = renderStep({}, { isSuperAdmin: true })

    const node = getByTestId('filters-upsert')
    const jsonText = node.findAllByType(Text)[0].props.children
    const flags = JSON.parse(jsonText)

    expect(flags).toEqual({
      showCategories: true,
      showCountries: false,
      showCoverImage: false,
      showAdditionalFields: true,
      showSaveButton: false,
      isSuperAdmin: true,
    })
  })

  // The "visa" toggle is a boolean — any defined value (even false) counts as answered,
  // so the baseline filled count is 1 even with an otherwise-empty form.
  it('reports filled count of 1/11 (visa answered) when no other fields are set', () => {
    const { getByText } = renderStep()
    expect(getByText('filled:1/11')).toBeTruthy()
  })

  it('increments the filled count as additional fields get populated', () => {
    const { getByText } = renderStep({
      categories: ['1'],
      transports: ['2'],
      year: '2024',
      budget: '500',
    })
    // 4 extra fields + the always-answered visa toggle = 5
    expect(getByText('filled:5/11')).toBeTruthy()
  })

  it('updates a field through FiltersUpsertComponent onFieldChange', () => {
    const { getByLabelText, setFormData } = renderStep()

    fireEvent.press(getByLabelText('set-budget'))

    expect(setFormData).toHaveBeenCalledTimes(1)
    const updater = setFormData.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater(baseFormData) : updater
    expect(next).toEqual(expect.objectContaining({ budget: '1000' }))
  })

  it('fires onNext from the header primary action', () => {
    const onNext = jest.fn()
    const { getByText } = renderStep({}, { onNext })

    fireEvent.press(getByText('К публикации'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
