import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'

export const enResources = {
  common,
  ...generatedResources,
  ...staticResources,
} as const
