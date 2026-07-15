import React, { forwardRef } from 'react'
import { Text } from 'react-native'
import RawFeather from '@expo/vector-icons/build/Feather'

import { useHydrationReady } from '@/hooks/useHydrationReady'

type FeatherProps = React.ComponentProps<typeof RawFeather>
type FeatherRef = React.ComponentRef<typeof RawFeather>

const FeatherHydrationSafe = forwardRef<FeatherRef, FeatherProps>(function FeatherHydrationSafe(
  { size = 12, style, ...props },
  ref,
) {
  const hydrationReady = useHydrationReady()

  if (!hydrationReady) {
    return (
      <Text
        aria-hidden
        style={[{ width: size, height: size, flexShrink: 0 }, style]}
      />
    )
  }

  return <RawFeather ref={ref} size={size} style={style} {...props} />
})

FeatherHydrationSafe.displayName = 'FeatherHydrationSafe'
Object.assign(FeatherHydrationSafe, RawFeather)

export default FeatherHydrationSafe as unknown as typeof RawFeather
