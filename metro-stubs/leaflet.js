function getLeaflet() {
  if (typeof window !== 'undefined' && window.L) {
    return window.L;
  }
  return {};
}

const leaflet = getLeaflet();

module.exports = leaflet;
module.exports.default = leaflet;
