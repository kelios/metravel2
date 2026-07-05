// #765: leaflet.markercluster — side-effect модуль, расширяющий реальный Leaflet
// (L.FeatureGroup.extend). В тестах leaflet замокан и расширять нечего — реальный
// плагин падает при импорте через utils/leafletVendor. Здесь no-op.
module.exports = {}
