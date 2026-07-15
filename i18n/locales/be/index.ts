import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'

export const beResources = {
  common,
  ...generatedResources,
  ...staticResources,
} as const

export type BeResources = typeof beResources
