import React from 'react'

import { PointCard } from '@/components/UserPoints/PointCard'

export const PointsListItem: React.FC<{
  point: any
  onPress?: (point: any) => void
  onEdit?: (point: any) => void
  onDelete?: (point: any) => void
  layout?: 'list' | 'grid'
  selectionMode?: boolean
  selected?: boolean
  active?: boolean
  compact?: boolean
  driveInfo?:
    | null
    | { status: 'loading' }
    | { status: 'ok'; distanceKm: number; durationMin: number }
    | { status: 'error' }
  onToggleSelect?: (point: any) => void
}> = React.memo(({ point, onPress, onEdit, onDelete, layout, selectionMode, selected, active, compact, driveInfo, onToggleSelect }) => {
  return (
    <PointCard
      point={point}
      onPress={onPress}
      onEdit={onEdit}
      onDelete={onDelete}
      layout={layout}
      selectionMode={selectionMode}
      selected={selected}
      active={active}
      compact={compact}
      driveInfo={driveInfo}
      onToggleSelect={onToggleSelect}
    />
  )
})
