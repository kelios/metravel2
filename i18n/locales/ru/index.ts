import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'

export const ruResources = {
  common,
  ...generatedResources,
  ...staticResources,
} as const

export type RuResources = typeof ruResources
