import type { ReactNode } from 'react'

export type NativeQuestVideoProps = {
  source: any
  posterSource?: any
  usePoster?: boolean
  style?: any
  useNativeControls?: boolean
  shouldPlay?: boolean
  isLooping?: boolean
  onError?: () => void
  onPlayingChange?: (playing: boolean) => void
}

export type QuestFinaleVideoProps = Pick<
  NativeQuestVideoProps,
  'source' | 'posterSource' | 'usePoster' | 'onPlayingChange'
> & {
  src?: string
  poster?: string
  fallback: ReactNode
  onWebError: () => void
  onNativeError: () => void
}
