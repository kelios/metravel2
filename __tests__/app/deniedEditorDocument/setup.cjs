'use strict'
// jsdom has no layout engine. Keep the real navigator/frame listener mounted;
// its initial getBoundingClientRect is deterministic, and geometry is browser QA.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
