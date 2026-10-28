import React, { lazy, memo, Suspense } from 'react'
import { StyleSheet, View } from 'react-native'
import type { VideoViewProps } from 'expo-video'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import type { NativeQuestVideoProps, QuestFinaleVideoProps } from './QuestFinaleVideo.types'

export const NativeQuestVideoLazy = lazy(() =>
  // expo-video belongs to the native owner; the web platform pair never imports it.
  Promise.resolve(import('expo-video')).then((module) => ({
    default: memo(function NativeQuestVideo(props: NativeQuestVideoProps) {
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

      // The shared typecheck selects Expo's web declaration; this owner uses native SDK props.
      const VideoView = module.VideoView as React.ComponentType<VideoViewProps>
      return (
        <View style={props.style}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={props.useNativeControls !== false}
            onFirstFrameRender={() => {
              if (sourceVisitRef.current.revision === sourceRevision) setFirstFrameRevision(sourceRevision)
            }}
          />
          {props.usePoster && props.posterSource && firstFrameRevision !== sourceRevision ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <ImageCardMedia
                source={props.posterSource}
                fit="contain"
                width="100%"
                style={StyleSheet.absoluteFill}
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

export default function QuestFinaleVideo({
  source,
  posterSource,
  usePoster,
  fallback,
  onNativeError,
  onPlayingChange,
}: QuestFinaleVideoProps) {
  return (
    <Suspense fallback={fallback}>
      <NativeQuestVideoLazy
        source={source}
        posterSource={posterSource}
        usePoster={usePoster}
        style={StyleSheet.absoluteFill}
        useNativeControls
        shouldPlay={false}
        isLooping={false}
        onError={onNativeError}
        onPlayingChange={onPlayingChange}
      />
    </Suspense>
  )
}
