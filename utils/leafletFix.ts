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
          try {
            return originalSetPosition(el, point)
          } catch {
            // Pane element may have been removed from the DOM during unmount / re-mount.
            // Swallow the error to prevent "Cannot set properties of undefined" crashes.
          }
        }
        instance.DomUtil.__metravelPatchedSetPosition = true
      }
    }

    // Patch Map.prototype.remove to catch "Map container is being reused by another instance".
    // react-leaflet's MapContainer calls map.remove() without try/catch on unmount.
    // If the container's _leaflet_id was overwritten by a new instance, remove() throws.
    if (leaflet?.Map?.prototype?.remove && !leaflet.Map.prototype.__metravelPatchedRemove) {
      const originalRemove = leaflet.Map.prototype.remove
      leaflet.Map.prototype.remove = function safeRemove() {
        try {
          return originalRemove.call(this)
        } catch (err: any) {
          if (
            typeof err?.message === 'string' &&
            err.message.includes('reused by another instance')
          ) {
            // Container was already claimed by a new map instance.
            // Do best-effort cleanup without touching the container.
            try { this._stop?.() } catch { /* noop */ }
            try {
              for (const i in this._handlers) {
                try { this._handlers[i]?.remove?.() } catch { /* noop */ }
              }
            } catch { /* noop */ }
            this._loaded = false
            return this
          }
          throw err
        }
      }
      leaflet.Map.prototype.__metravelPatchedRemove = true
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
