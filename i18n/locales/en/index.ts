import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'
import { offline } from './offline'

export const enResources = {
  common,
  offline,
  ...generatedResources,
  ...staticResources,
} as const
