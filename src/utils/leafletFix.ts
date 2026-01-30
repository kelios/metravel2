if (typeof window !== 'undefined') {
  try {
    const leaflet = require('leaflet')

    const anyL: any = leaflet as any
    if (anyL?.Icon?.Default?.prototype && typeof anyL?.Icon?.Default?.mergeOptions === 'function') {
      delete (anyL.Icon.Default.prototype as any)._getIconUrl

      anyL.Icon.Default.mergeOptions({
        iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
        iconUrl: require('leaflet/dist/images/marker-icon.png'),
        shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
      })
    }
  } catch {
    // noop
  }
}

export {}
