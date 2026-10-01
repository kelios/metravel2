import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import { usePathname, useRouter } from 'expo-router'

import HeaderContextBar from '@/components/layout/HeaderContextBar'
import { resetScreenHeaderForTests, useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import ScreenHeader from '@/components/ui/ScreenHeader'

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
    pageContextTitle: 'Fallback',
    currentTitle: 'Fallback',
    backToPath: null,
    items: [{ label: 'Fallback', path: '/x' }],
  }),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => (global as any).__mockResponsive,
}))

const phone = { width: 390, height: 844, isPhone: true, isLargePhone: false, isDesktop: false, isMobile: true }
const desktop = { width: 1400, height: 900, isPhone: false, isLargePhone: false, isDesktop: true, isMobile: false }

const onPlus = jest.fn()

function Screen() {
  const header = useScreenHeader({
    title: 'Мои поездки',
    info: ['Описание раздела', 'Организую. Подробности'],
    primaryAction: { icon: 'plus', label: 'Организовать поездку', onPress: onPlus, testID: 'plus' },
  })
  return <ScreenHeader header={header} />
}

function Harness() {
  return (
    <>
      <HeaderContextBar />
      <Screen />
    </>
  )
}

describe('useScreenHeader (#2099)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetScreenHeaderForTests()
    ;(usePathname as jest.Mock).mockReturnValue('/trips/my')
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false })
  })

  it('phone: строка рисует заголовок, (i) и действие, тело не рисует H1', () => {
    ;(global as any).__mockResponsive = phone
    const { getAllByText, queryByTestId, getByLabelText, getByTestId, queryByText } = render(<Harness />)
    expect(getAllByText('Мои поездки')).toHaveLength(1)
    expect(queryByTestId('screen-header')).toBeNull()
    expect(queryByText('Fallback')).toBeNull()
    expect(getByLabelText('Организовать поездку')).toBeTruthy()
    expect(getByTestId('screen-header-info')).toBeTruthy()
    fireEvent.press(getByTestId('plus'))
    expect(onPlus).toHaveBeenCalledTimes(1)
  })

  it('phone: (i) открывает лист с пояснением', () => {
    ;(global as any).__mockResponsive = phone
    const { getByTestId, queryByText, getByText } = render(<Harness />)
    expect(queryByText('Описание раздела')).toBeNull()
    fireEvent.press(getByTestId('screen-header-info'))
    expect(getByText('Описание раздела')).toBeTruthy()
  })

  it('desktop: ScreenHeader рисует H1, описание и кнопку с подписью', () => {
    ;(global as any).__mockResponsive = desktop
    const { getAllByText, getByText, getByTestId, queryByTestId } = render(<Harness />)
    expect(getAllByText('Мои поездки')).toHaveLength(1)
    expect(getByText('Описание раздела')).toBeTruthy()
    expect(getByText('Организовать поездку')).toBeTruthy()
    expect(getByTestId('screen-header')).toBeTruthy()
    expect(queryByTestId('screen-header-info')).toBeNull()
  })

  it('снятие экрана возвращает заголовок из хлебных крошек', () => {
    ;(global as any).__mockResponsive = phone
    const view = render(<Harness />)
    view.unmount()
    const bar = render(<HeaderContextBar />)
    expect(bar.getByText('Fallback')).toBeTruthy()
  })

  it('web до гидратации (ширина 0): десктопная шапка с h1 в разметке, не телефонная', () => {
    const original = Platform.OS
    jest.replaceProperty(Platform, 'OS', 'web')
    try {
      ;(global as any).__mockResponsive = { width: 0, height: 0, isPhone: false, isLargePhone: false, isHydrated: false }
      // Бар монтируется только после гидратации, до неё в HTML лишь тело экрана.
      const { getByTestId, getByText, getAllByText } = render(<Screen />)
      expect(getByTestId('screen-header')).toBeTruthy()
      // Метка для критического CSS: на телефоне до гидратации блок скрыт без прыжка контента.
      expect(getByTestId('screen-header').props.dataSet).toEqual({ screenHeader: 'desktop' })
      expect(getAllByText('Мои поездки')).toHaveLength(1)
      expect(getByText('Описание раздела')).toBeTruthy()
    } finally {
      jest.replaceProperty(Platform, 'OS', original)
    }
  })
})
