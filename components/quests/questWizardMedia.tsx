import React, { lazy, memo } from 'react'
import { StyleSheet, View } from 'react-native'

import QuestFullMapLazy from '@/components/quests/QuestFullMapLazy'
import ImageCardMedia from '@/components/ui/ImageCardMedia'

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
      onPlayingChange?: (playing: boolean) => void
    }) {
      const uri = typeof props.source === 'string' ? props.source : props.source?.uri ?? null
      const sourceVisitRef = React.useRef({ uri, revision: 0 })
      if (sourceVisitRef.current.uri !== uri) {
        sourceVisitRef.current = { uri, revision: sourceVisitRef.current.revision + 1 }
      }
      const sourceRevision = sourceVisitRef.current.revision
      const [firstFrameRevision, setFirstFrameRevision] = React.useState<number | null>(null)
      const player = module.useVideoPlayer(uri, (p: any) => {
        p.loop = !!props.isLooping
        if (props.shouldPlay) p.play()
      })

      const { onError } = props
      React.useEffect(() => {
        if (!player || !onError) return
        const sub = player.addListener('statusChange', (payload: any) => {
          if (sourceVisitRef.current.revision === sourceRevision && payload?.status === 'error') onError()
        })
        return () => sub?.remove?.()
      }, [player, onError, sourceRevision])

      const { onPlayingChange } = props
      React.useEffect(() => {
        if (!player || !onPlayingChange) return
        const notify = (playing: boolean) => {
          if (sourceVisitRef.current.revision === sourceRevision) onPlayingChange(playing)
        }
        notify(Boolean(player.playing))
        const playing = player.addListener('playingChange', (payload: { isPlaying: boolean }) => {
          notify(payload.isPlaying)
        })
        const ended = player.addListener('playToEnd', () => notify(false))
        return () => {
          playing?.remove?.()
          ended?.remove?.()
        }
      }, [player, onPlayingChange, sourceRevision])

      // VideoView типизирован пересечением web+native плееров — для кросс-платформенного вызова ослабляем тип
      const VideoView = module.VideoView as unknown as React.ComponentType<any>
      return (
        <View style={props.style}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            nativeControls={props.useNativeControls !== false}
            onFirstFrameRender={() => {
              if (sourceVisitRef.current.revision === sourceRevision) setFirstFrameRevision(sourceRevision)
            }}
          />
          {props.usePoster && props.posterSource && firstFrameRevision !== sourceRevision ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <ImageCardMedia
                source={props.posterSource}
                fit="contain"
                width="100%"
                style={StyleSheet.absoluteFillObject}
                showImmediately
                testID="quest-video-poster"
              />
            </View>
          ) : null}
        </View>
      )
    }),
  }))
)

export const QuestWebVideo = memo(function QuestWebVideo({
  src,
  poster,
  onError,
  onPlayingChange,
}: {
  src?: string
  poster?: string
  onError: () => void
  onPlayingChange?: (playing: boolean) => void
}) {
  // @ts-ignore -- React Native Web allows direct DOM element creation via React.createElement
  return React.createElement('video', {
    key: src,
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
      onPlayingChange?.(false)
      onError()
    },
    onPlay: () => onPlayingChange?.(true),
    onPause: () => onPlayingChange?.(false),
    onEnded: () => onPlayingChange?.(false),
  })
})
