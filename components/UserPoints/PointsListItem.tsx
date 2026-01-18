import React from 'react'

import { PointCard } from '@/components/UserPoints/PointCard'

export const PointsListItem: React.FC<{
  point: any
  siteCategoryLookup: Map<string, string>
}> = ({ point, siteCategoryLookup }) => {
  return <PointCard point={point} siteCategoryLookup={siteCategoryLookup} />
}
