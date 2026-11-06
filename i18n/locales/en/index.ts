import { places } from './places'
import { books } from './books'
import { common } from './common'
import { generatedResources } from './generated'
import { staticResources } from './static'
import { offline } from './offline'

export const enResources = {
  common,
  books,
  offline,
  places,
  ...generatedResources,
  ...staticResources,
} as const
