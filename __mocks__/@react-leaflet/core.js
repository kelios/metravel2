// #2059: ядро react-leaflet — чистый ESM, jest его не трансформирует, а
// `utils/leafletVendor` теперь импортирует его ради контекста карты (группа
// кластеров планировщика как контейнер для `<Marker>`). Сам react-leaflet в
// тестах всегда замокан, поэтому здесь нужен только контекст: та же форма, что
// у `@react-leaflet/core/lib/context.js`.
const React = require('react')

const CONTEXT_VERSION = 1
const LeafletContext = React.createContext(null)

module.exports = {
  CONTEXT_VERSION,
  LeafletContext,
  createLeafletContext: (map) => Object.freeze({ __version: CONTEXT_VERSION, map }),
  extendContext: (source, extra) => Object.freeze({ ...source, ...extra }),
  useLeafletContext: () => {
    const context = React.useContext(LeafletContext)
    if (context == null) {
      throw new Error('No context provided: useLeafletContext() can only be used in a descendant of <MapContainer>')
    }
    return context
  },
}
