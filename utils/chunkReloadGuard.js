/* global module */

const CHUNK_RELOAD_SCRIPT_ID = 'metravel-chunk-reload';
const RELOAD_GUARD_KEY = 'mt:chunk-reload-ts';
const RELOAD_WINDOW_MS = 30_000;

// Keep this factory self-contained and ES5: the same function is embedded in
// HTML, where neither Metro nor the application entry point is available.
function createChunkReloadGuard(win, key, windowMs) {
  var attempted = false;
  var storage;
  // Capture the real storage BEFORE the HTML shell replaces blocked storage
  // with an in-memory shim (which cannot protect the next document).
  try { storage = win.sessionStorage; } catch (_) { void _; /* Recovery stays disabled without persistent storage. */ }
  return function () {
    if (attempted || !storage) return false;
    try {
      var now = Date.now();
      var last = Number(storage.getItem(key));
      if (isFinite(last) && last > 0 && now - last < windowMs) return false;
      storage.setItem(key, String(now));
      // Some browsers silently discard writes. Fail closed in that case too.
      if (storage.getItem(key) !== String(now)) return false;
      attempted = true;
      win.location.reload();
      return true;
    } catch (_) {
      void _;
      return false;
    }
  };
}

function reloadOnceForStaleChunk(win) {
  if (!win.__metravelReloadStaleChunk) {
    win.__metravelReloadStaleChunk = createChunkReloadGuard(win, RELOAD_GUARD_KEY, RELOAD_WINDOW_MS);
  }
  return win.__metravelReloadStaleChunk();
}

function getChunkReloadBootstrapScript() {
  return `(function(){
if(window.__metravelReloadStaleChunk)return;
window.__metravelReloadStaleChunk=(${createChunkReloadGuard.toString()})(window,${JSON.stringify(RELOAD_GUARD_KEY)},${RELOAD_WINDOW_MS});
window.addEventListener('error',function(event){
  var target=event&&event.target;
  if(!target||target.tagName!=='SCRIPT'||!target.src)return;
  try{
    var url=new URL(target.src,window.location.href);
    if(url.origin===window.location.origin&&/^\\/_expo\\/static\\/js\\/web\\/.+\\.js$/i.test(url.pathname)){
      window.__metravelReloadStaleChunk();
    }
  }catch(_){}
},true);
})();`;
}

module.exports = { CHUNK_RELOAD_SCRIPT_ID, getChunkReloadBootstrapScript, reloadOnceForStaleChunk };
