import React from 'react'
import { render } from '@testing-library/react-native'

let mockStorePlatform: 'ios' | 'android' | null = null

jest.mock('@/hooks/useDeviceStorePlatform', () => ({
  useDeviceStorePlatform: () => mockStorePlatform,
}))

jest.mock('@/i18n', () => ({
  translate: (key: string) => key,
}))

jest.mock('@/utils/openAppStoreListing', () => ({
  openAppStoreListing: jest.fn(() => Promise.resolve(true)),
}))

const storeOrder = (root: Awaited<ReturnType<typeof render>>) =>
  root
    .getAllByTestId(/^app-store-buttons-(ios|android)$/)
    .map((node) => [String(node.props.testID).replace('app-store-buttons-', ''), node])

describe('AppStoreButtons', () => {
  const { Platform } = require('react-native')
  const originalOS = Platform.OS

  beforeEach(() => {
    // Поверхности скачивания — web; native-случай выставляет платформу сам.
    Platform.OS = 'web'
  })

  afterAll(() => {
    Platform.OS = originalOS
  })

  const AppStoreButtons = require('@/components/appDownload/AppStoreButtons').default

  it.each([
    [null, ['ios', 'android']],
    ['ios', ['ios', 'android']],
    ['android', ['android', 'ios']],
  ] as const)('device store %s goes first', async (platform, expected) => {
    mockStorePlatform = platform
    const root = await render(<AppStoreButtons source="app_page" />)

    expect(storeOrder(root).map(([store]) => store)).toEqual(expected)
  })

  it('shows only the own store inside the native app', async () => {
    Platform.OS = 'ios'
    mockStorePlatform = 'ios'
    const root = await render(<AppStoreButtons source="app_page" />)

    expect(storeOrder(root).map(([store]) => store)).toEqual(['ios'])
  })

  it('keeps both stores reachable on every web device', async () => {
    mockStorePlatform = 'android'
    const root = await render(<AppStoreButtons source="app_page" />)

    expect(root.getByLabelText('sharedStatic:appDownload.appStore.a11y')).toBeTruthy()
    expect(root.getByLabelText('sharedStatic:appDownload.googlePlay.a11y')).toBeTruthy()
  })
})
