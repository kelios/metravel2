type LeafletRuntime = typeof import('leaflet')
type ReactLeafletRuntime = typeof import('react-leaflet')

export async function loadLeafletRuntime(): Promise<{
  L: LeafletRuntime
  RL: ReactLeafletRuntime
}> {
  await import('@/utils/leafletFix')

  const [leafletModule, reactLeafletModule] = await Promise.all([
    import('leaflet'),
    import('react-leaflet'),
  ])

  return {
    L: ((leafletModule as any).default ?? leafletModule) as LeafletRuntime,
    RL: ((reactLeafletModule as any).default ?? reactLeafletModule) as ReactLeafletRuntime,
  }
}
