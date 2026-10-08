import React, { Suspense } from 'react'
import { act, cleanupAsync, renderAsync } from '@testing-library/react-native/pure'
import { View } from 'react-native'

const mockRemoveListener = jest.fn()
const mockStatusListener = jest.fn()
const mockListeners = new Map<string, (...args: unknown[]) => void>()
const mockPlayer = {
  playing: false,
  loop: false,
  play: jest.fn(),
  addListener: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
    mockListeners.set(event, callback)
    if (event === 'statusChange') mockStatusListener.mockImplementation(callback)
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

import { NativeQuestVideoLazy, QuestWebVideo } from '@/components/quests/questWizardMedia'

const video = (uri = 'https://cdn.example/finale.mp4', usePoster = true, onError = jest.fn(), onPlayingChange = jest.fn()) => (
  <Suspense fallback={<View testID="loading-video" />}>
    <NativeQuestVideoLazy source={{ uri }} posterSource={{ uri: 'https://cdn.example/poster.webp' }}
      usePoster={usePoster} style={{ width: 300, height: 200 }} useNativeControls shouldPlay isLooping onError={onError} onPlayingChange={onPlayingChange} />
  </Suspense>
)

afterEach(async () => {
  await cleanupAsync()
  mockListeners.clear()
  mockPlayer.playing = false
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


it('seeds actual playing state, handles SDK pause/end, and removes all event subscriptions', async () => {
  mockPlayer.playing = true
  const changed = jest.fn()
  const screen = await renderAsync(video(undefined, true, jest.fn(), changed))
  expect(changed).toHaveBeenLastCalledWith(true)
  act(() => mockListeners.get('playingChange')!({ isPlaying: false }))
  expect(changed).toHaveBeenLastCalledWith(false)
  act(() => mockListeners.get('playingChange')!({ isPlaying: true }))
  expect(changed).toHaveBeenLastCalledWith(true)
  act(() => mockListeners.get('playToEnd')!())
  expect(changed).toHaveBeenLastCalledWith(false)
  await screen.unmountAsync()
  expect(mockRemoveListener).toHaveBeenCalledTimes(3)
})

it('ignores playing/end/error events from previous source visits, including returning to the same URI', async () => {
  const changed = jest.fn()
  const error = jest.fn()
  const screen = await renderAsync(video(undefined, true, error, changed))
  const previousPlaying = mockListeners.get('playingChange')!
  const previousEnd = mockListeners.get('playToEnd')!
  const previousError = mockListeners.get('statusChange')!
  await screen.rerenderAsync(video('https://cdn.example/second.mp4', true, error, changed))
  changed.mockClear()
  act(() => {
    previousPlaying({ isPlaying: true })
    previousEnd()
    previousError({ status: 'error' })
  })
  expect(changed).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  act(() => mockListeners.get('playingChange')!({ isPlaying: true }))
  expect(changed).toHaveBeenCalledWith(true)
  await screen.rerenderAsync(video(undefined, true, error, changed))
  changed.mockClear()
  act(() => previousPlaying({ isPlaying: true }))
  expect(changed).not.toHaveBeenCalled()
})


it('web maps actual play, pause, ended and error events to caption state without hiding controls', async () => {
  const playing = jest.fn()
  const error = jest.fn()
  const screen = await renderAsync(<QuestWebVideo src="https://cdn.example/finale.mp4" onError={error} onPlayingChange={playing} />)
  const node = screen.UNSAFE_getByType('video')
  expect(node.props.controls).toBe(true)
  expect(node.props.playsInline).toBe(true)
  act(() => node.props.onPlay())
  expect(playing).toHaveBeenLastCalledWith(true)
  act(() => node.props.onPause())
  expect(playing).toHaveBeenLastCalledWith(false)
  act(() => node.props.onPlay())
  act(() => node.props.onEnded())
  expect(playing).toHaveBeenLastCalledWith(false)
  act(() => node.props.onError())
  expect(playing).toHaveBeenLastCalledWith(false)
  expect(error).toHaveBeenCalledTimes(1)
})
