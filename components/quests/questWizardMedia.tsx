import React, { lazy, memo, useEffect } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'

export const BelkrajWidgetLazy = lazy(() => import('@/components/belkraj/BelkrajWidget'))

export const QuestFullMapLazy = lazy(() => import('@/components/quests/QuestFullMap'))

export const getQuestClipboard = () => import('expo-clipboard')

export const NativeQuestVideoLazy = lazy(() =>
  import('expo-av').then((module) => ({
    default: memo(function NativeQuestVideo(props: {
      source: any
      posterSource?: any
      usePoster?: boolean
      style?: any
      useNativeControls?: boolean
      shouldPlay?: boolean
      isLooping?: boolean
      onError?: () => void
    }) {
      return (
        <module.Video
          {...props}
          resizeMode={module.ResizeMode.CONTAIN}
          // @ts-ignore -- playsInline is a web-only video attribute not in expo-av Video types
          playsInline
        />
      )
    }),
  }))
)

export const QuestWebVideo = memo(function QuestWebVideo({
  src,
  poster,
  onError,
}: {
  src?: string
  poster?: string
  onError: () => void
}) {
  useEffect(() => {
    if (src) {
      console.info('[WebVideo] Rendering video with src:', src)
    }
  }, [src])

  // @ts-ignore -- React Native Web allows direct DOM element creation via React.createElement
  return React.createElement('video', {
    src,
    poster,
    controls: true,
    playsInline: true,
    preload: 'metadata',
    // @ts-ignore -- inline style object for web video element, not a RN StyleSheet type
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      backgroundColor: DESIGN_TOKENS.colors.text,
    },
    onError: (event: any) => {
      console.error('[WebVideo] Video error:', event?.target?.error)
      onError()
    },
    onLoadStart: () => console.info('[WebVideo] Video load started'),
    onLoadedMetadata: () => console.info('[WebVideo] Video metadata loaded'),
    onCanPlay: () => console.info('[WebVideo] Video can play'),
  })
})
