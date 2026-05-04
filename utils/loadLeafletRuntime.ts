type LeafletRuntime = typeof import('leaflet')
type ReactLeafletRuntime = typeof import('react-leaflet')

export async function loadLeafletRuntime(): Promise<{
  L: LeafletRuntime
  RL: ReactLeafletRuntime
}> {
  const [leafletModule, reactLeafletModule, leafletFixModule] = await Promise.all([
    import('leaflet'),
    import('react-leaflet'),
    import('@/utils/leafletFix'),
  ])

  const L = ((leafletModule as any).default ?? leafletModule) as LeafletRuntime
  const RL = ((reactLeafletModule as any).default ?? reactLeafletModule) as ReactLeafletRuntime

  try {
    ;(leafletFixModule as any).applyLeafletFix?.(L)
  } catch {
    // noop
  }

  return { L, RL }
}
