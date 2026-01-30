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

    if (anyL?.DomUtil?.getPosition && anyL?.Point && !anyL.DomUtil.__metravelPatchedGetPosition) {
      const originalGetPosition = anyL.DomUtil.getPosition
      anyL.DomUtil.getPosition = (el: any) => {
        if (!el) {
          return new anyL.Point(0, 0)
        }
        return originalGetPosition(el)
      }
      anyL.DomUtil.__metravelPatchedGetPosition = true
    }
  } catch {
    // noop
  }
}

export {}
