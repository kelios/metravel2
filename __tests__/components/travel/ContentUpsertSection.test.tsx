import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

// Make React.lazy render synchronously: instead of suspending on the dynamic
// import, eagerly require the (mocked) module and render its default export.
// Avoids RNTL's awkward unmount-on-suspend behaviour for the lazy ArticleEditor.
jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    lazy: () => (props: any) => {
      const mod = require('@/components/article/ArticleEditor')
      const Comp = mod && mod.default ? mod.default : mod
      return actual.createElement(Comp, props)
    },
  }
})

import ContentUpsertSection from '@/components/travel/ContentUpsertSection'
import type { TravelFormData } from '@/types/types'

let mockArticleEditorInstanceSequence = 0

// Stub the lazy ArticleEditor so the derived UI around it renders synchronously.
jest.mock('@/components/article/ArticleEditor', () => {
  const MockArticleEditor = (props: any) => {
    const React = require('react')
    const { Text } = require('react-native')
    const instanceRef = React.useRef<number | null>(null)
    if (instanceRef.current === null) {
      mockArticleEditorInstanceSequence += 1
      instanceRef.current = mockArticleEditorInstanceSequence
    }
    return (
      <Text
        testID={`editor-${props.label}`}
        accessibilityHint={`instance-${instanceRef.current}`}
      >
        {`editor:${props.label}`}
      </Text>
    )
  }

  return { __esModule: true, default: MockArticleEditor }
})

jest.mock('@/components/forms/TextInputComponent', () => (props: any) => {
  const { View, Text, TextInput } = require('react-native')
  return (
    <View>
      <Text>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={(v: string) => props.onChange?.(v)}
        placeholder={props.placeholder}
      />
    </View>
  )
})

jest.mock('@/hooks/useWebSpeechDictation', () => ({
  useWebSpeechDictation: () => ({
    isSupported: false,
    isListening: false,
    interimText: '',
    start: jest.fn(),
    stop: jest.fn(),
    bindFinalTextHandler: jest.fn(),
  }),
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
  useResponsive: jest.fn(() => ({ isHydrated: true, isMobile: false })),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }))
jest.mock('expo-file-system', () => ({ readAsStringAsync: jest.fn() }))
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))

const baseFormData: TravelFormData = {
  id: '5',
  name: '',
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

const renderSection = (override: Partial<TravelFormData> = {}) =>
  render(
    <ContentUpsertSection
      formData={{ ...baseFormData, ...override }}
      setFormData={jest.fn()}
    />,
  )

describe('ContentUpsertSection — derived display logic', () => {
  afterEach(() => {
    const useResponsive = require('@/hooks/useResponsive').useResponsive as jest.Mock
    useResponsive.mockReturnValue({ isHydrated: true, isMobile: false })
  })

  it('prompts for a minimum description when empty', () => {
    const { getByText } = renderSection({ description: '' })
    expect(getByText(/Минимум 50 символов/)).toBeTruthy()
    expect(getByText('0 символов')).toBeTruthy()
  })

  it('shows remaining characters when below the 50-char minimum', () => {
    const { getByText } = renderSection({ description: 'a'.repeat(40) })
    // 50 - 40 = 10 remaining
    expect(getByText('Осталось 10 символов до минимума')).toBeTruthy()
    expect(getByText('40 символов')).toBeTruthy()
  })

  it('acknowledges a good short description in the 50–150 range', () => {
    const { getByText } = renderSection({ description: 'b'.repeat(80) })
    expect(getByText(/Хорошее краткое описание/)).toBeTruthy()
    expect(getByText('80 символов')).toBeTruthy()
  })

  it('celebrates a detailed description above 150 chars', () => {
    const { getByText } = renderSection({ description: 'c'.repeat(200) })
    expect(getByText('Отличное подробное описание!')).toBeTruthy()
    expect(getByText('200 символов')).toBeTruthy()
  })

  it('strips HTML tags and entities when counting description length', () => {
    const html = '<p>Hello&nbsp;<b>world</b></p>'
    // plain text -> "Hello world" = 11 chars
    const { getByText } = renderSection({ description: html })
    expect(getByText('11 символов')).toBeTruthy()
  })

  it('computes 0% form progress when required fields are empty', () => {
    const { getByText } = renderSection()
    expect(getByText('0%')).toBeTruthy()
  })

  it('computes 50% form progress when 2 of 4 required fields are filled', () => {
    const { getByText } = renderSection({
      name: 'Поездка',
      description: 'd'.repeat(60),
    })
    expect(getByText('50%')).toBeTruthy()
  })

  it('computes 100% form progress when all required fields are filled', () => {
    const { getByText } = renderSection({
      name: 'Поездка',
      description: 'd'.repeat(60),
      countries: ['1'],
      categories: ['2'],
    })
    expect(getByText('100%')).toBeTruthy()
  })

  it('hides the progress block when showProgress is false', () => {
    const { queryByText } = render(
      <ContentUpsertSection
        formData={baseFormData}
        setFormData={jest.fn()}
        showProgress={false}
      />,
    )
    expect(queryByText('Прогресс заполнения')).toBeNull()
  })

  it('renders only the requested fields when visibleFields is constrained', () => {
    const { getByText, queryByText } = render(
      <ContentUpsertSection
        formData={baseFormData}
        setFormData={jest.fn()}
        visibleFields={['name']}
      />,
    )
    expect(getByText('Название')).toBeTruthy()
    expect(queryByText('Плюсы')).toBeNull()
    expect(queryByText('Минусы')).toBeNull()
  })

  it('preserves a trailing space in the focused Android description until the next word is typed', () => {
    const useResponsive = require('@/hooks/useResponsive').useResponsive as jest.Mock
    useResponsive.mockReturnValue({ isHydrated: true, isMobile: true })

    const Harness = () => {
      const [formData, setFormData] = React.useState<TravelFormData>({
        ...baseFormData,
        description: '',
      })

      return <ContentUpsertSection formData={formData} setFormData={setFormData} />
    }

    const { getByTestId } = render(<Harness />)
    const input = getByTestId('travel-wizard.basic.description.mobile-input')

    fireEvent(input, 'focus')
    fireEvent.changeText(input, 'синий ')
    expect(getByTestId('travel-wizard.basic.description.mobile-input').props.value).toBe('синий ')

    fireEvent.changeText(getByTestId('travel-wizard.basic.description.mobile-input'), 'синий берег')
    expect(getByTestId('travel-wizard.basic.description.mobile-input').props.value).toBe('синий берег')
  })

  it('syncs the latest edit content after the focused Android description blurs', () => {
    const useResponsive = require('@/hooks/useResponsive').useResponsive as jest.Mock
    useResponsive.mockReturnValue({ isHydrated: true, isMobile: true })
    const setFormData = jest.fn()

    const { getByTestId, rerender } = render(
      <ContentUpsertSection
        formData={{ ...baseFormData, description: '<p>Старый текст</p>' }}
        setFormData={setFormData}
      />,
    )

    const input = getByTestId('travel-wizard.basic.description.mobile-input')
    fireEvent(input, 'focus')
    fireEvent.changeText(input, 'Черновик пользователя ')

    rerender(
      <ContentUpsertSection
        formData={{ ...baseFormData, description: '<p>Внешнее обновление</p>' }}
        setFormData={setFormData}
      />,
    )

    expect(getByTestId('travel-wizard.basic.description.mobile-input').props.value)
      .toBe('Черновик пользователя ')

    fireEvent(getByTestId('travel-wizard.basic.description.mobile-input'), 'blur')

    expect(getByTestId('travel-wizard.basic.description.mobile-input').props.value)
      .toBe('Внешнее обновление')
  })

  it('keeps the fullscreen editor mounted when a new travel receives its server id', () => {
    const useResponsive = require('@/hooks/useResponsive').useResponsive as jest.Mock
    useResponsive.mockReturnValue({ isHydrated: true, isMobile: true })
    const setFormData = jest.fn()

    const { getByLabelText, getByTestId, rerender } = render(
      <ContentUpsertSection
        formData={{ ...baseFormData, id: null as any }}
        setFormData={setFormData}
      />,
    )

    fireEvent.press(getByLabelText('Открыть расширенный редактор описания'))
    const firstInstance = getByTestId('editor-Описание').props.accessibilityHint

    rerender(
      <ContentUpsertSection
        formData={{ ...baseFormData, id: '999' }}
        setFormData={setFormData}
      />,
    )

    expect(getByTestId('editor-Описание').props.accessibilityHint).toBe(firstInstance)
  })
})
