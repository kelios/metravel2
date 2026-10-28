/* global module */
// Pure CSS reserve shared by React owners and build-time stylesheet generation.
function webDockReserve(extra = 0, minimum = 0) {
  if (minimum > 0) return `calc(max(var(--mt-dock-h, 0px), ${minimum}px) + ${extra}px)`
  return `calc(var(--mt-dock-h, 0px) + ${extra}px)`
}

module.exports = { webDockReserve }
