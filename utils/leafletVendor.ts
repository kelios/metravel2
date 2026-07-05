// #765: единственная точка sync-импорта leaflet-вендора (leaflet + markercluster +
// react-leaflet). Второй sync-импортёр в другом async-чанке (как было с
// require('leaflet.markercluster') в MarkerClusterGroup) заставляет Metro хойстить
// весь вендор в eager __common, который грузится на каждой странице. Новый код
// получает L/RL только через loadLeafletRuntime / useLeafletLoader.
import * as leafletModule from 'leaflet'
import 'leaflet.markercluster'
import * as reactLeafletModule from 'react-leaflet'

export { leafletModule, reactLeafletModule }
