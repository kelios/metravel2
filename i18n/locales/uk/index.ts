import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'

export const ukResources = {
  common,
  ...generatedResources,
  ...staticResources,
} as const

export type UkResources = typeof ukResources
