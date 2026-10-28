import React, { Suspense } from 'react'
import { act, cleanup, render } from '@testing-library/react-native/pure'
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

import QuestFinaleVideo, { NativeQuestVideoLazy } from '@/components/quests/QuestFinaleVideo'
import QuestWebVideo from '@/components/quests/QuestFinaleVideo.web'

const video = (uri = 'https://cdn.example/finale.mp4', usePoster = true, onError = jest.fn(), onPlayingChange = jest.fn()) => (
  // Keep the query host mounted while Suspense replaces its loading branch.
  <View>
    <Suspense fallback={<View testID="loading-video" />}>
      <NativeQuestVideoLazy source={{ uri }} posterSource={{ uri: 'https://cdn.example/poster.webp' }}
        usePoster={usePoster} style={{ width: 300, height: 200 }} useNativeControls shouldPlay isLooping onError={onError} onPlayingChange={onPlayingChange} />
    </Suspense>
  </View>
)

afterEach(async () => {
  await cleanup()
  mockListeners.clear()
  mockPlayer.playing = false
  jest.clearAllMocks()
})

it('uses the actual SDK first-frame boundary, keeps player controls and resets poster for a new source', async () => {
  const screen = await render(video())
  const poster = await screen.findByTestId('quest-video-poster')
  expect(poster.props.source).toEqual({ uri: 'https://cdn.example/poster.webp' })
  expect(poster.props.fit).toBe('contain')
  const firstVideo = screen.getByTestId('sdk-video')
  const firstFrameRender = firstVideo.props.onFirstFrameRender
  expect(firstVideo.props.nativeControls).toBe(true)
  expect(firstVideo.props.contentFit).toBe('contain')
  expect(mockPlayer.loop).toBe(true)
  expect(mockPlayer.play).toHaveBeenCalled()

  await act(() => firstFrameRender())
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  await screen.rerender(video('https://cdn.example/other.mp4'))
  expect(screen.getByTestId('quest-video-poster')).toBeTruthy()
  await act(() => firstFrameRender())
  expect(screen.getByTestId('quest-video-poster')).toBeTruthy()
  await act(() => screen.getByTestId('sdk-video').props.onFirstFrameRender())
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  await act(() => firstFrameRender())
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  await screen.rerender(video())
  expect(screen.getByTestId('quest-video-poster')).toBeTruthy()
})

it('does not add a poster when disabled and preserves actual status/error subscription cleanup', async () => {
  const onError = jest.fn()
  const screen = await render(video(undefined, false, onError))
  await screen.findByTestId('sdk-video')
  expect(screen.queryByTestId('quest-video-poster')).toBeNull()
  await act(() => mockStatusListener({ status: 'error' }))
  expect(onError).toHaveBeenCalledTimes(1)
  await screen.unmount()
  expect(mockRemoveListener).toHaveBeenCalled()
})


it('seeds actual playing state, handles SDK pause/end, and removes all event subscriptions', async () => {
  mockPlayer.playing = true
  const changed = jest.fn()
  const screen = await render(video(undefined, true, jest.fn(), changed))
  await screen.findByTestId('sdk-video')
  expect(changed).toHaveBeenLastCalledWith(true)
  await act(() => mockListeners.get('playingChange')!({ isPlaying: false }))
  expect(changed).toHaveBeenLastCalledWith(false)
  await act(() => mockListeners.get('playingChange')!({ isPlaying: true }))
  expect(changed).toHaveBeenLastCalledWith(true)
  await act(() => mockListeners.get('playToEnd')!())
  expect(changed).toHaveBeenLastCalledWith(false)
  await screen.unmount()
  expect(mockRemoveListener).toHaveBeenCalledTimes(3)
})

it('ignores playing/end/error events from previous source visits, including returning to the same URI', async () => {
  const changed = jest.fn()
  const error = jest.fn()
  const screen = await render(video(undefined, true, error, changed))
  await screen.findByTestId('sdk-video')
  const previousPlaying = mockListeners.get('playingChange')!
  const previousEnd = mockListeners.get('playToEnd')!
  const previousError = mockListeners.get('statusChange')!
  await screen.rerender(video('https://cdn.example/second.mp4', true, error, changed))
  changed.mockClear()
  await act(() => {
    previousPlaying({ isPlaying: true })
    previousEnd()
    previousError({ status: 'error' })
  })
  expect(changed).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  await act(() => mockListeners.get('playingChange')!({ isPlaying: true }))
  expect(changed).toHaveBeenCalledWith(true)
  await screen.rerender(video(undefined, true, error, changed))
  changed.mockClear()
  await act(() => previousPlaying({ isPlaying: true }))
  expect(changed).not.toHaveBeenCalled()
})


it('web maps actual play, pause, ended and error events to caption state without hiding controls', async () => {
  const playing = jest.fn()
  const error = jest.fn()
  const nativeError = jest.fn()
  const screen = await render(<QuestWebVideo source={{ uri: 'https://cdn.example/native.mp4' }}
    src="https://cdn.example/finale.mp4" poster="https://cdn.example/poster.webp" fallback={null}
    onWebError={error} onNativeError={nativeError} onPlayingChange={playing} />)
  const node = screen.toJSON()
  if (!node || Array.isArray(node)) throw new Error('Expected a single rendered video element')
  expect(node.type).toBe('video')
  expect(node.props.src).toBe('https://cdn.example/finale.mp4')
  expect(node.props.poster).toBe('https://cdn.example/poster.webp')
  expect(node.props.controls).toBe(true)
  expect(node.props.playsInline).toBe(true)
  expect(node.props.preload).toBe('metadata')
  await act(() => node.props.onPlay())
  expect(playing).toHaveBeenLastCalledWith(true)
  await act(() => node.props.onPause())
  expect(playing).toHaveBeenLastCalledWith(false)
  await act(() => node.props.onPlay())
  await act(() => node.props.onEnded())
  expect(playing).toHaveBeenLastCalledWith(false)
  await act(() => node.props.onError())
  expect(playing).toHaveBeenLastCalledWith(false)
  expect(error).toHaveBeenCalledTimes(1)
  expect(nativeError).not.toHaveBeenCalled()
})

it('native adapter retains the original source, controls, paused start and native error callback', async () => {
  const nativeError = jest.fn()
  const webError = jest.fn()
  const screen = await render(<View><QuestFinaleVideo source={{ uri: 'https://cdn.example/native-source.mp4' }}
    src="https://cdn.example/web-alias.mp4" posterSource={{ uri: 'https://cdn.example/native-poster.webp' }}
    poster="https://cdn.example/web-poster.webp" usePoster fallback={<View testID="loading-video" />}
    onWebError={webError} onNativeError={nativeError} /></View>)

  await screen.findByTestId('sdk-video')
  expect(mockUseVideoPlayer).toHaveBeenLastCalledWith('https://cdn.example/native-source.mp4', expect.any(Function))
  expect(screen.getByTestId('quest-video-poster').props.source).toEqual({ uri: 'https://cdn.example/native-poster.webp' })
  expect(screen.getByTestId('sdk-video').props.nativeControls).toBe(true)
  expect(mockPlayer.loop).toBe(false)
  expect(mockPlayer.play).not.toHaveBeenCalled()
  await act(() => mockStatusListener({ status: 'error' }))
  expect(nativeError).toHaveBeenCalledTimes(1)
  expect(webError).not.toHaveBeenCalled()
})
