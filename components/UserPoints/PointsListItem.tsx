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
  onToggleSelect?: (point: any) => void
}> = ({ point, onPress, onEdit, onDelete, layout, selectionMode, selected, onToggleSelect }) => {
  return (
    <PointCard
      point={point}
      onPress={onPress}
      onEdit={onEdit}
      onDelete={onDelete}
      layout={layout}
      selectionMode={selectionMode}
      selected={selected}
      onToggleSelect={onToggleSelect}
    />
  )
}
