import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import { PLACE_LIST_ROW_HEIGHT } from '@/components/places/PlaceListRow'
import {
  POINTS_LIST_ROW_SKELETON_COUNT,
  PointSkeletonRow,
  PointsListSkeleton,
} from '@/components/UserPoints/PointsListSkeleton'
import { DESIGN_TOKENS } from '@/constants/designSystem'

describe('PointsListSkeleton — строки телефона (#3142)', () => {
  it('каркас пина в ячейке списка без своего отступа и той же высоты, что строка (#2253)', async () => {
    const utils = await render(<PointSkeletonRow testID="row-skeleton" />)
    const style = StyleSheet.flatten(utils.getByTestId('row-skeleton', { includeHiddenElements: true }).props.style)
    expect(style.minHeight).toBe(PLACE_LIST_ROW_HEIGHT)
    expect(style.marginBottom).toBeUndefined()
  })

  it('список каркасов: строки с шагом ячеек списка', async () => {
    const utils = await render(<PointsListSkeleton variant="row" />)
    const root = utils.getByTestId('userpoints-list-skeleton', { includeHiddenElements: true })
    const rows = root.children as any[]
    expect(rows).toHaveLength(POINTS_LIST_ROW_SKELETON_COUNT)
    expect(StyleSheet.flatten(rows[0].props.style).marginBottom).toBe(DESIGN_TOKENS.spacing.sm)
  })
})
