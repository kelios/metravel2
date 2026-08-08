import type { ReactNode } from 'react'

import type { ArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia'

export type DeferredStableContentProps = {
  html: string
  contentWidth: number
  fullWidth?: boolean
  serverSanitized?: boolean
  articleBodyMedia?: ArticleBodyMediaIndex | null
  fallback?: ReactNode
}
