import { Suspense } from 'react';
import { Text } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

import TravelWizardStepDetails from '@/components/travel/TravelWizardStepDetails'
import type { TravelFormData } from '@/types/types'

// Lightweight header stub: surfaces the props the step feeds it (title, warningCount).
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

// Stub the lazy ArticleEditor so we can drive onChange per field without the real editor.
jest.mock('@/components/article/ArticleEditor', () => (props: any) => {
  const { View, Text, Pressable } = require('react-native')
  return (
    <View testID={`editor-${props.label}`}>
      <Text>{`editor:${props.label}:${props.content}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`change-${props.label}`}
        onPress={() => props.onChange(`new ${props.label}`)}
      >
        <Text>{`change-${props.label}`}</Text>
      </Pressable>
    </View>
  )
})

jest.mock('@/components/travel/ValidationFeedback', () => ({
  ValidationSummary: (props: any) => {
    const { View, Text } = require('react-native')
    return (
      <View>
        <Text>{`summary-errors:${props.errorCount}`}</Text>
        <Text>{`summary-warnings:${props.warningCount}`}</Text>
      </View>
    )
  },
  CollapsibleValidationSummary: (props: any) => {
    const { View, Text } = require('react-native')
    return (
      <View>
        <Text>{`collapsible-warnings:${props.warningCount}`}</Text>
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
  useResponsive: () => ({ isHydrated: true, isMobile: false }),
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
  year: '2024',
  budget: '',
  number_peoples: '2',
  number_days: '3',
  visa: false,
  publish: false,
  moderation: false,
}

const renderStep = (override: Partial<TravelFormData> = {}, props: any = {}) => {
  const setFormData = jest.fn()
  const utils = render(
    <Suspense fallback={<Text>loading…</Text>}>
      <TravelWizardStepDetails
        currentStep={4}
        totalSteps={6}
        formData={{ ...baseFormData, ...override }}
        setFormData={setFormData}
        onBack={jest.fn()}
        onNext={jest.fn()}
        {...props}
      />
    </Suspense>,
  )
  return { ...utils, setFormData }
}

describe('TravelWizardStepDetails (Шаг 4)', () => {
  it('renders the three optional editors and the section title', async () => {
    const { getByText, getByTestId } = renderStep()

    expect(getByText('Для кого это путешествие')).toBeTruthy()
    await waitFor(() => expect(getByTestId('editor-Плюсы')).toBeTruthy())
    expect(getByTestId('editor-Минусы')).toBeTruthy()
    expect(getByTestId('editor-Рекомендации')).toBeTruthy()
  })

  it('shows the title from stepMeta when provided', () => {
    const { getByText } = renderStep({}, { stepMeta: { title: 'Кастомный заголовок' } })
    expect(getByText('Кастомный заголовок')).toBeTruthy()
  })

  it('counts filled recommendation fields (0 of 3 when all empty)', () => {
    const { getByText } = renderStep()
    expect(getByText('0 из 3')).toBeTruthy()
  })

  it('counts filled recommendation fields (2 of 3 when plus and minus set)', () => {
    const { getByText } = renderStep({ plus: 'Удобно', minus: 'Дорого' })
    expect(getByText('2 из 3')).toBeTruthy()
  })

  it('updates formData.plus through the Плюсы editor onChange', async () => {
    const { getByLabelText, setFormData } = renderStep()

    await waitFor(() => expect(getByLabelText('change-Плюсы')).toBeTruthy())
    fireEvent.press(getByLabelText('change-Плюсы'))

    expect(setFormData).toHaveBeenCalledTimes(1)
    const updater = setFormData.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater(baseFormData) : updater
    expect(next).toEqual(expect.objectContaining({ plus: 'new Плюсы' }))
  })

  it('updates formData.minus through the Минусы editor onChange', async () => {
    const { getByLabelText, setFormData } = renderStep()

    await waitFor(() => expect(getByLabelText('change-Минусы')).toBeTruthy())
    fireEvent.press(getByLabelText('change-Минусы'))

    const updater = setFormData.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater(baseFormData) : updater
    expect(next).toEqual(expect.objectContaining({ minus: 'new Минусы' }))
  })

  it('updates formData.recommendation through the Рекомендации editor onChange', async () => {
    const { getByLabelText, setFormData } = renderStep()

    await waitFor(() => expect(getByLabelText('change-Рекомендации')).toBeTruthy())
    fireEvent.press(getByLabelText('change-Рекомендации'))

    const updater = setFormData.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater(baseFormData) : updater
    expect(next).toEqual(expect.objectContaining({ recommendation: 'new Рекомендации' }))
  })

  it('forwards existing field content into the editors', async () => {
    const { getByText } = renderStep({
      plus: 'Существующий плюс',
      minus: 'Существующий минус',
    })

    await waitFor(() => expect(getByText('editor:Плюсы:Существующий плюс')).toBeTruthy())
    expect(getByText('editor:Минусы:Существующий минус')).toBeTruthy()
  })

  it('fires onNext from the header primary action', () => {
    const onNext = jest.fn()
    const { getByText } = renderStep({}, { onNext })

    fireEvent.press(getByText('К публикации'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
