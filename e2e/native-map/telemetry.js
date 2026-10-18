'use strict'

// A diagnostic observer only: no zoom/network/marker commands are injected.
function observerScript(nonce, seconds) {
  return `(() => {
    if (typeof map === 'undefined' || typeof __metravelMarkerEntries === 'undefined') return false;
    if (window.__metravelQaMapObserver) window.__metravelQaMapObserver.stop();
    const state = { last: performance.now(), maxFrameMs: 0, frames: 0, sequence: 0, stopped: false };
    let frame, timer, expiry;
    function tick(now) {
      if (state.stopped) return;
      state.maxFrameMs = Math.max(state.maxFrameMs, now - state.last);
      state.last = now; state.frames += 1;
      frame = requestAnimationFrame(tick);
    }
    function snapshot() {
      const keys = Object.keys(__metravelMarkerEntries).sort();
      const desired = Object.keys(__metravelMarkerDesired).sort();
      const markerIds = keys.map(key => __metravelMarkerEntries[key].marker._leaflet_id);
      const layerIds = markersLayer.getLayers().filter(layer => layer instanceof L.Marker)
        .map(layer => layer._leaflet_id).sort((a,b) => a-b);
      return { type: 'METRAVEL_QA_MAP_SNAPSHOT', nonce: ${JSON.stringify(nonce)},
        at: Date.now(), sequence: ++state.sequence, mapId: map._containerId, zoom: map.getZoom(),
        markerZoomAnimation: map.options.markerZoomAnimation === true,
        keys, desired, markerIds, layerIds,
        queued: __metravelMarkerQueue.length,
        scheduled: __metravelMarkerFrameScheduled,
        animating: !!map._animatingZoom || !!(map._panAnim && map._panAnim._inProgress),
        tiles: window.__metravelGetTileStats(),
        tilesLoading: window.__metravelBaseTileLayer.isLoading(), frames: state.frames,
        maxFrameMs: state.maxFrameMs };
    }
    function stop() {
      state.stopped = true; cancelAnimationFrame(frame); clearInterval(timer); clearTimeout(expiry);
      if (window.__metravelQaMapObserver === observer) delete window.__metravelQaMapObserver;
    }
    const observer = { snapshot, stop };
    window.__metravelQaMapObserver = observer;
    frame = requestAnimationFrame(tick);
    timer = setInterval(() => {
      window.ReactNativeWebView.postMessage(JSON.stringify(snapshot()));
    }, 200);
    expiry = setTimeout(stop, ${seconds * 1000});
    return true;
  })()`;
}

class Acceptance {
  constructor({ expectedKeys, settleMs = 600, stageMs = 20000 } = {}) {
    if (!Array.isArray(expectedKeys) || expectedKeys.length !== 869 ||
        !expectedKeys.every(key => typeof key === 'string' && key) || new Set(expectedKeys).size !== 869) {
      throw new Error('Exactly 869 independent fixture keys are required');
    }
    this.expectedKeys = [...expectedKeys].sort();
    this.settleMs = settleMs;
    this.stageMs = stageMs;
    this.started = Date.now();
    this.stageStarted = this.started;
    this.stage = 0;
    this.baseline = null;
    this.stableSince = null;
    this.stableIdentity = null;
    this.previous = null;
    this.checkpoints = [];
  }

  consume(s, now = Date.now()) {
    this.assertWithinBudget(now);
    const fail = message => { throw new Error(message); };
    if (!s || !Number.isFinite(s.zoom) || !Number.isSafeInteger(s.mapId) ||
        !Number.isSafeInteger(s.at) || !Number.isSafeInteger(s.sequence) || s.sequence < 1 ||
        ![s.keys, s.desired, s.markerIds, s.layerIds].every(Array.isArray) ||
        !Number.isSafeInteger(s.frames) || s.frames < 0 || !Number.isFinite(s.maxFrameMs) || s.maxFrameMs < 0 ||
        typeof s.scheduled !== 'boolean' || typeof s.animating !== 'boolean' ||
        !Number.isInteger(s.queued) || s.queued < 0 || typeof s.tilesLoading !== 'boolean' ||
        !s.tiles || !Number.isInteger(s.tiles.pending) || s.tiles.pending < 0) fail('Malformed map telemetry');
    if (Math.abs(now - s.at) > 5000 || (this.previous &&
        (s.at <= this.previous.at || s.sequence <= this.previous.sequence || s.frames < this.previous.frames))) {
      fail('Stale, duplicate or reordered map telemetry');
    }
    this.previous = { at: s.at, sequence: s.sequence, frames: s.frames };
    if (s.markerZoomAnimation !== true) fail('markerZoomAnimation must remain enabled');
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const unique = values => new Set(values).size === values.length;
    const complete = same(s.keys, this.expectedKeys) && same(s.keys, s.desired) &&
      s.markerIds.length === s.keys.length && unique(s.keys) && unique(s.markerIds) &&
      s.markerIds.every(id => Number.isSafeInteger(id) && id > 0) &&
      same([...s.markerIds].sort((a,b) => a-b), s.layerIds);
    if (this.baseline && (!complete || !same(s.keys, this.baseline.keys) ||
        !same(s.markerIds, this.baseline.markerIds) || s.mapId !== this.baseline.mapId)) {
      fail('Marker loss, duplication, replacement or map reload after baseline');
    }
    const expectedZoom = this.baseline ? this.baseline.zoom + [0, 1, 2, 1][this.stage] : s.zoom;
    if (this.baseline && !s.animating && ![expectedZoom, this.checkpoints.at(-1).zoom].includes(s.zoom)) fail('Unexpected zoom sequence');
    const settled = complete && !s.scheduled && !s.queued && !s.animating &&
      s.tiles.pending === 0 && !s.tilesLoading && s.frames > 0 && s.zoom === expectedZoom;
    if (!settled) { this.stableSince = null; this.stableIdentity = null; return false; }
    const identity = JSON.stringify([s.keys, s.markerIds, s.mapId, s.zoom]);
    if (this.stableSince === null || identity !== this.stableIdentity) {
      this.stableSince = s.at; this.stableIdentity = identity;
    }
    if (s.at - this.stableSince < this.settleMs) return false;
    if (!this.baseline) this.baseline = { keys: [...s.keys], markerIds: [...s.markerIds], mapId: s.mapId, zoom: s.zoom };
    this.checkpoints.push({ stage: this.stage, zoom: s.zoom, count: s.keys.length,
      elapsedMs: now - this.started, maxFrameMs: s.maxFrameMs, frames: s.frames });
    this.stage += 1; this.stageStarted = now; this.stableSince = null;
    return this.stage === 4;
  }

  assertWithinBudget(now = Date.now()) {
    if (now - this.stageStarted > this.stageMs) throw new Error(`No settled map assertion for stage ${this.stage} within ${this.stageMs}ms`);
  }
}

module.exports = { observerScript, Acceptance };
