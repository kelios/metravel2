import React, { Suspense } from 'react'
import { act, cleanupAsync, renderAsync } from '@testing-library/react-native/pure'
import { View } from 'react-native'

const mockRemoveListener = jest.fn()
const mockStatusListener = jest.fn()
const mockPlayer = {
  loop: false,
  play: jest.fn(),
  addListener: jest.fn((_event: string, callback: (payload: { status: string }) => void) => {
    mockStatusListener.mockImplementation(callback)
    return { remove: mockRemoveListener }
  }),
}
const mockUseVideoPlayer = jest.fn((_uri: string, setup: (player: typeof mockPlayer) => void) => {
  setup(mockPlayer)
  return mockPlayer
})

jest.mock('expo-video', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    useVideoPlayer: (...args: Parameters<typeof mockUseVideoPlayer>) => mockUseVideoPlayer(...args),
    VideoView: (props: object) => React.createElement(View, { testID: 'sdk-video', ...props }),
  }
})
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { __esModule: true, default: (props: object) => React.createElement(View, props) }
})

import { NativeQuestVideoLazy } from '@/components/quests/questWizardMedia'

const video = (uri = 'https://cdn.example/finale.mp4', usePoster = true, onError = jest.fn()) => (
  <Suspense fallback={<View testID="loading-video" />}>
    <NativeQuestVideoLazy source={{ uri }} posterSource={{ uri: 'https://cdn.example/poster.webp' }}
      usePoster={usePoster} style={{ width: 300, height: 200 }} useNativeControls shouldPlay isLooping onError={onError} />
  </Suspense>
)

afterEach(async () => {
  await cleanupAsync()
  jest.clearAllMocks()
})

it('uses the actual SDK first-frame boundary, keeps player controls and resets poster for a new source', async () => {
  const screen = await renderAsync(video())
  const poster = screen.getByTestId('quest-video-poster')
  expect(poster.props.source).toEqual({ uri: 'https://cdn.example/poster.webp' })
  expect(poster.props.fit).toBe('contain')
  const firstVideo = screen.getByTestId('sdk-video')
  const firstFrameRender = firstVideo.props.onFirstFrameRender
  expect(firstVideo.props.nativeControls).toBe(true)
  expect(firstVideo.props.contentFit).toBe('contain')
  expect(mockPlayer.loop).toBe(true)
  expect(mockPlayer.play).toHaveBeenCalled()

  act(() => firstFrameRender())
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  await screen.rerenderAsync(video('https://cdn.example/other.mp4'))
  expect(screen.getByTestId('quest-video-poster')).toBeTruthy()
  act(() => firstFrameRender())
  expect(screen.getByTestId('quest-video-poster')).toBeTruthy()
  act(() => screen.getByTestId('sdk-video').props.onFirstFrameRender())
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  act(() => firstFrameRender())
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  await screen.rerenderAsync(video())
  expect(screen.getByTestId('quest-video-poster')).toBeTruthy()
})

it('does not add a poster when disabled and preserves actual status/error subscription cleanup', async () => {
  const onError = jest.fn()
  const screen = await renderAsync(video(undefined, false, onError))
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  act(() => mockStatusListener({ status: 'error' }))
  expect(onError).toHaveBeenCalledTimes(1)
  await screen.unmountAsync()
  expect(mockRemoveListener).toHaveBeenCalled()
})
