type LeafletRuntime = typeof import('leaflet')
type ReactLeafletRuntime = typeof import('react-leaflet')

export async function loadLeafletRuntime(): Promise<{
  L: LeafletRuntime
  RL: ReactLeafletRuntime
}> {
  // #765: leaflet/react-leaflet/markercluster импортируются sync ТОЛЬКО внутри
  // leafletVendor — единый async-чанк вместо хойста вендора в eager __common.
  const [vendorModule, leafletFixModule] = await Promise.all([
    import('@/utils/leafletVendor'),
    import('@/utils/leafletFix'),
  ])

  const { leafletModule, reactLeafletModule } = vendorModule
  const L = ((leafletModule as any).default ?? leafletModule) as LeafletRuntime
  const RL = ((reactLeafletModule as any).default ?? reactLeafletModule) as ReactLeafletRuntime

  try {
    ;(leafletFixModule as any).applyLeafletFix?.(L)
  } catch {
    // noop
  }

  return { L, RL }
}
