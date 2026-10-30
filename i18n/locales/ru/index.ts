import { books } from './books'
import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'
import { offline } from './offline'

export const ruResources = {
  common,
  books,
  offline,
  ...generatedResources,
  ...staticResources,
} as const

export type RuResources = typeof ruResources
