import React, { lazy, memo } from 'react'

import QuestFullMapLazy from '@/components/quests/QuestFullMapLazy'

export const BelkrajWidgetLazy = lazy(() => import('@/components/belkraj/BelkrajWidget'))

export { QuestFullMapLazy }

export const getQuestClipboard = () => Promise.resolve(import('expo-clipboard'))

export const NativeQuestVideoLazy = lazy(() =>
  // expo-av был удалён из Expo SDK 56 (его native-модуль крашил регистрацию модулей);
  // нативное видео финала квеста играем через expo-video.
  Promise.resolve(import('expo-video')).then((module) => ({
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
      const uri = typeof props.source === 'string' ? props.source : props.source?.uri ?? null
      const player = module.useVideoPlayer(uri, (p: any) => {
        p.loop = !!props.isLooping
        if (props.shouldPlay) p.play()
      })

      const { onError } = props
      React.useEffect(() => {
        if (!player || !onError) return
        const sub = player.addListener('statusChange', (payload: any) => {
          if (payload?.status === 'error') onError()
        })
        return () => sub?.remove?.()
      }, [player, onError])

      // VideoView типизирован пересечением web+native плееров — для кросс-платформенного вызова ослабляем тип
      const VideoView = module.VideoView as unknown as React.ComponentType<any>
      return (
        <VideoView
          player={player}
          style={props.style}
          contentFit="contain"
          nativeControls={props.useNativeControls !== false}
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
      backgroundColor: '#000',
    },
    onError: () => {
      onError()
    },
  })
})
