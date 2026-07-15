import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'

export const plResources = {
  common,
  ...generatedResources,
  ...staticResources,
} as const
