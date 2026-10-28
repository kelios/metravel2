import React, { memo } from 'react'

import { DESIGN_COLORS } from '@/constants/designSystem'
import type { QuestFinaleVideoProps } from './QuestFinaleVideo.types'

export default memo(function QuestFinaleVideo({
  src,
  poster,
  onWebError,
  onPlayingChange,
}: QuestFinaleVideoProps) {
  return React.createElement('video', {
    key: src,
    src,
    poster,
    controls: true,
    playsInline: true,
    preload: 'metadata',
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      backgroundColor: DESIGN_COLORS.videoBackdrop,
    },
    onError: () => {
      onPlayingChange?.(false)
      onWebError()
    },
    onPlay: () => onPlayingChange?.(true),
    onPause: () => onPlayingChange?.(false),
    onEnded: () => onPlayingChange?.(false),
  })
})
