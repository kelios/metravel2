// Patches Leaflet to be resilient to react-leaflet remount races.
// Exports a function that takes an already-loaded Leaflet instance so this
// module does not statically import 'leaflet' (which would lift Leaflet into
// the common chunk via Metro's shared-module hoisting).

const patchLeafletInstance = (instance: any) => {
  if (!instance) return

  if (instance?.Icon?.Default?.prototype && typeof instance?.Icon?.Default?.mergeOptions === 'function') {
    delete (instance.Icon.Default.prototype as any)._getIconUrl

    try {
      instance.Icon.Default.mergeOptions({
        iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
        iconUrl: require('leaflet/dist/images/marker-icon.png'),
        shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
      })
    } catch {
      // noop
    }
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

  if (instance?.DomUtil?.create && !instance.DomUtil.__metravelPatchedCreate) {
    instance.DomUtil.create = (tagName: string, className?: string, container?: any) => {
      const el = document.createElement(tagName)
      if (className) el.className = className
      if (container && typeof container.appendChild === 'function') {
        container.appendChild(el)
      }
      return el
    }
    instance.DomUtil.__metravelPatchedCreate = true
  }

  if (instance?.DomUtil?.setPosition && !instance.DomUtil.__metravelPatchedSetPosition) {
    const originalSetPosition = instance.DomUtil.setPosition
    instance.DomUtil.setPosition = (el: any, point: any) => {
      if (!el) return
      try {
        return originalSetPosition(el, point)
      } catch {
        // noop
      }
    }
    instance.DomUtil.__metravelPatchedSetPosition = true
  }

  if (instance?.Map?.prototype && !instance.Map.prototype.__metravelPatchedGetPane) {
    const originalGetPane = instance.Map.prototype.getPane
    instance.Map.prototype.getPane = function safeGetPane(name?: string) {
      const pane = originalGetPane.call(this, name)
      if (pane) return pane
      // Leaflet-внутренности без null-check вызывают
      // getPane(name).appendChild(). На Safari при remount кастомный pane может
      // ещё не существовать, хотя карта уже живая. Создаём его синхронно:
      // get-or-create вызовы всё равно получат отдельный pane и не применят
      // pointer-events/z-index кастомного слоя к общему mapPane.
      if (
        this._panes?.mapPane &&
        typeof name === 'string' &&
        name &&
        typeof this.createPane === 'function'
      ) {
        try {
          const createdPane = this.createPane(name)
          if (createdPane) return createdPane
        } catch {
          // Продолжаем к безопасному fallback ниже.
        }
      }
      // Умершая/пересоздаваемая карта: Leaflet-внутренности зовут
      // getPane().appendChild() без null-check — отдаём безопасный узел.
      // Для отсутствующего именованного pane на живой карте не возвращаем
      // mapPane: route-слои могут назначить ему pointer-events:none.
      if (this._panes?.mapPane && typeof name === 'string' && name) {
        return document.createElement('div')
      }
      if (this._mapPane) return this._mapPane
      if (this._container && typeof this._container.appendChild === 'function') return this._container
      return document.createElement('div')
    }
    instance.Map.prototype.__metravelPatchedGetPane = true
  }

  if (instance?.Map?.prototype?.remove && !instance.Map.prototype.__metravelPatchedRemove) {
    const originalRemove = instance.Map.prototype.remove
    instance.Map.prototype.remove = function safeRemove() {
      try {
        return originalRemove.call(this)
      } catch (err: any) {
        if (
          typeof err?.message === 'string' &&
          err.message.includes('reused by another instance')
        ) {
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
    instance.Map.prototype.__metravelPatchedRemove = true
  }
}

export function applyLeafletFix(L: any): void {
  if (typeof window === 'undefined') return
  try {
    patchLeafletInstance(L)

    const globalL = (globalThis as any)?.L
    if (globalL && globalL !== L) {
      patchLeafletInstance(globalL)
    } else if (!globalL) {
      try {
        ;(globalThis as any).L = L
      } catch {
        // noop
      }
    }
  } catch {
    // noop
  }
}

export {}
