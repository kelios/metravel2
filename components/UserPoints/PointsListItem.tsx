import React from 'react'

import { PointCard } from '@/components/UserPoints/PointCard'

export const PointsListItem: React.FC<{
  point: any
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: (point: any) => void
}> = ({ point, selectionMode, selected, onToggleSelect }) => {
  return (
    <PointCard
      point={point}
      selectionMode={selectionMode}
      selected={selected}
      onToggleSelect={onToggleSelect}
    />
  )
}
