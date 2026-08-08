import StableContent from '@/components/travel/StableContent'
import type { DeferredStableContentProps } from '@/components/travel/DeferredStableContent.types'

export default function DeferredStableContent({
  fallback: _fallback,
  ...props
}: DeferredStableContentProps) {
  return <StableContent {...props} />
}
