if (typeof window !== 'undefined') {
  try {
    const leaflet = require('leaflet')

    const patchLeaflet = (instance: any) => {
      if (!instance) return

      if (instance?.Icon?.Default?.prototype && typeof instance?.Icon?.Default?.mergeOptions === 'function') {
        delete (instance.Icon.Default.prototype as any)._getIconUrl

        instance.Icon.Default.mergeOptions({
          iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
          iconUrl: require('leaflet/dist/images/marker-icon.png'),
          shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
        })
      }

      if (instance?.DomUtil?.getPosition && instance?.Point && !instance.DomUtil.__metravelPatchedGetPosition) {
        const originalGetPosition = instance.DomUtil.getPosition
        instance.DomUtil.getPosition = (el: any) => {
          if (!el) {
            return new instance.Point(0, 0)
          }
          return originalGetPosition(el)
        }
        instance.DomUtil.__metravelPatchedGetPosition = true
      }

      if (instance?.DomUtil?.setPosition && !instance.DomUtil.__metravelPatchedSetPosition) {
        const originalSetPosition = instance.DomUtil.setPosition
        instance.DomUtil.setPosition = (el: any, point: any) => {
          if (!el) return
          return originalSetPosition(el, point)
        }
        instance.DomUtil.__metravelPatchedSetPosition = true
      }
    }

    patchLeaflet(leaflet)

    const globalL = (globalThis as any)?.L
    if (globalL && globalL !== leaflet) {
      patchLeaflet(globalL)
    } else if (!globalL) {
      try {
        ;(globalThis as any).L = leaflet
      } catch {
        // noop
      }
    }
  } catch {
    // noop
  }
}

export {}
