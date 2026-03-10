export async function loadLeafletRuntime() {
  await import('@/utils/leafletFix')

  const [leafletModule, reactLeafletModule] = await Promise.all([
    import('leaflet'),
    import('react-leaflet'),
  ])

  return {
    L: (leafletModule as any).default ?? leafletModule,
    RL: (reactLeafletModule as any).default ?? reactLeafletModule,
  }
}
