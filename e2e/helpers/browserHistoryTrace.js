/* Browser observation only: no synthetic entries, router actions or recovery. */
const crypto = require('node:crypto')

function createPathSanitizer({ origin, travelIds = [], slugs = [], userIds = [] }) {
  const identities = new Map()
  const known = new Set(['/', '/metravel', '/profile', '/search', '/login', '/travel/new',
    ...travelIds.map(id => `/travel/${id}`), ...slugs.map(slug => `/travels/${slug}`),
    ...userIds.map(id => `/user/${id}`)])
  function safe(value, depth = 0) {
    const raw = String(value ?? '')
    if (!identities.has(raw)) identities.set(raw, `path-${identities.size + 1}`)
    const equalityId = identities.get(raw)
    try {
      const url = new URL(raw, origin)
      if (depth > 2 || raw.length > 2048 || url.origin !== origin || url.username || url.password || !known.has(url.pathname)) {
        return { path: '[redacted-path]', equalityId }
      }
      const query = new URLSearchParams()
      let redacted = false
      for (const [key, val] of url.searchParams) {
        if (key === 'returnTo') {
          const nested = safe(val, depth + 1)
          if (!val.startsWith('/') || val.startsWith('//') || nested.path.includes('[redacted')) redacted = true
          else query.append(key, nested.path)
        } else if ((key === 'step' && /^[1-6]$/.test(val)) ||
          (['page', 'perPage'].includes(key) && /^\d{1,3}$/.test(val)) ||
          (key === 'locale' && ['ru', 'be', 'uk', 'pl', 'en'].includes(val)) ||
          (key === 'previewTravel' && travelIds.map(String).includes(val))) query.append(key, val)
        else redacted = true
      }
      if (redacted) query.set('_redacted', '1')
      const hash = /^(#(?:top|main-content|photos|publish|route|step-[1-6]))?$/.test(url.hash) ? url.hash : '#redacted'
      return { path: `${url.pathname}${query.size ? `?${query}` : ''}${hash}`, equalityId }
    } catch { return { path: '[invalid-path]', equalityId } }
  }
  return safe
}

function safeScriptUrl(value, origin) {
  try {
    const url = new URL(value)
    return url.origin === origin && /^\/_expo\/static\/js\/web\/[\w.-]+\.js(?:\.map)?$/.test(url.pathname)
      ? `${url.origin}${url.pathname}` : '[redacted-script]'
  } catch { return '[redacted-script]' }
}

// Self-contained when serialized into initScript; the sanitizer is supplied as
// source, not reimplemented. The binding is installed before the first document.
function installHistoryObserver(config, makeSanitizer) {
  if (window.__editorHistoryObserved) return
  window.__editorHistoryObserved = true
  const sanitize = makeSanitizer(config)
  let sequence = 0
  // Inspect only ordinary data fields: observing a pushState argument must not
  // invoke its getters before the browser performs the original serialization.
  const state = value => Object.fromEntries(['id', 'key', 'idx', 'index'].flatMap(key => {
    const field = value != null ? Object.getOwnPropertyDescriptor(Object(value), key)?.value : undefined
    return ['string', 'number'].includes(typeof field) ? [[key, typeof field === 'string' ? field.slice(0, 100) : field]] : []
  }))
  const stack = () => String(new Error().stack || '').split('\n').slice(0, 16).map(line =>
    line.replace(/https?:\/\/[^\s)]+/g, raw => {
      const match = /^(.*?)(:\d+:\d+)?$/.exec(raw)
      try {
        const url = new URL(match[1])
        return url.origin === config.origin && /^\/_expo\/static\/js\/web\/[\w.-]+\.js$/.test(url.pathname)
          ? `${url.origin}${url.pathname}${match[2] || ''}` : '[redacted-source]'
      } catch { return '[redacted-source]' }
    })).join('\n')
  const record = (kind, extra = {}) => {
    try {
      const entry = { kind, sequence: ++sequence, at: Date.now(), now: performance.now(), timeOrigin: performance.timeOrigin,
        location: sanitize(location.href), state: state(history.state), historyLength: history.length, ...extra }
      window.__editorHistoryRecord(entry).catch(() => {})
    } catch { /* Never change native navigation on observer failure. */ }
  }
  for (const method of ['go', 'back', 'forward', 'pushState', 'replaceState']) {
    const original = history[method]
    let host = history
    while (host && !Object.getOwnPropertyDescriptor(host, method)) host = Object.getPrototypeOf(host)
    const descriptor = host && Object.getOwnPropertyDescriptor(host, method)
    Object.defineProperty(history, method, { configurable: true, enumerable: descriptor?.enumerable ?? false, writable: true,
      value: function (...args) {
        try {
          const writing = method === 'pushState' || method === 'replaceState'
          const detail = { method, delta: method === 'go' && Number.isFinite(args[0]) ? args[0] : null,
            target: writing && (args[2] == null || typeof args[2] === 'string') ? sanitize(args[2] ?? location.href) : null,
            targetState: writing ? state(args[0]) : null, stack: stack() }
          record('history-call-before', detail)
        } catch { record('observer-error', { method }) }
        try {
          const result = Reflect.apply(original, this, args)
          record('history-call-after', { method })
          return result
        } catch (error) { record('history-call-threw', { method, errorName: error?.name }); throw error }
      } })
  }
  for (const name of ['popstate', 'hashchange', 'beforeunload', 'pagehide', 'pageshow']) {
    addEventListener(name, event => record(name, { eventState: name === 'popstate' ? state(event.state) : null,
      persisted: typeof event.persisted === 'boolean' ? event.persisted : null }))
  }
  record('installed')
}

async function observeBrowserHistory(context, page, config) {
  const entries = []
  const cdp = await context.newCDPSession(page)
  const sanitize = createPathSanitizer(config)
  const scripts = new Map()
  const historyReads = []
  const add = entry => entries.push({ nodeSequence: entries.length + 1, observedAt: Date.now(), ...entry })
  await page.exposeBinding('__editorHistoryRecord', (_source, entry) => {
    add(entry)
    if (entry.kind === 'popstate') historyReads.push(readHistory().then(history => add({ kind: 'cdp-popstate-history', history })).catch(() => {}))
  })
  await context.addInitScript({ content: `(${installHistoryObserver})(${JSON.stringify(config)}, ${createPathSanitizer});` })
  await cdp.send('Page.enable')
  cdp.on('Debugger.scriptParsed', event => {
    if (safeScriptUrl(event.url, config.origin) !== '[redacted-script]') scripts.set(event.scriptId, event)
  })
  await cdp.send('Debugger.enable')
  const onFrame = frame => { if (frame === page.mainFrame()) add({ kind: 'main-frame-navigated', location: sanitize(frame.url()) }) }
  const onRequest = request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) add({ kind: 'document-request', location: sanitize(request.url()) })
  }
  page.on('framenavigated', onFrame)
  page.on('request', onRequest)
  async function readHistory() {
    const browser = await cdp.send('Page.getNavigationHistory')
    const document = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, stateId: history.state?.id ?? null,
      navigationName: performance.getEntriesByType('navigation')[0]?.name ?? null }))
    return { currentIndex: browser.currentIndex, entries: browser.entries.map(item => ({ id: item.id, ...sanitize(item.url) })),
      ...document, navigationName: sanitize(document.navigationName).path }
  }
  return {
    entries, cdp, readHistory, sanitize, origin: config.origin,
    command(name) { const command = { kind: 'user-command', name, id: `command-${entries.length + 1}` }; add(command); return entries.length - 1 },
    async sources(write) {
      const called = [...scripts.values()].filter(script => entries.some(entry => entry.stack?.includes(safeScriptUrl(script.url, config.origin))))
      const result = []
      for (const script of called) {
        const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId })
        const sha256 = crypto.createHash('sha256').update(scriptSource).digest('hex')
        await write(`${sha256}.js`, scriptSource)
        let mapPath = null
        if (script.sourceMapURL) {
          const resolved = new URL(script.sourceMapURL, script.url).toString()
          if (safeScriptUrl(resolved, config.origin) !== '[redacted-script]') {
            const response = await context.request.get(resolved)
            if (response.ok()) { await write(`${sha256}.js.map`, await response.text()); mapPath = `${sha256}.js.map` }
          }
        }
        result.push({ scriptId: script.scriptId, url: safeScriptUrl(script.url, config.origin), sha256, source: `${sha256}.js`, sourceMap: mapPath })
      }
      return result
    },
    async stop() {
      await Promise.all(historyReads)
      page.off('framenavigated', onFrame); page.off('request', onRequest)
      await cdp.detach().catch(() => {})
    },
  }
}

// Optional second pass: the caller supplies a reviewed exact-script location
// and a WHITELISTED summary expression, never a full scope/store serialization.
async function armScopeCapture(trace, capture, emit) {
  if (safeScriptUrl(capture.url, trace.origin) === '[redacted-script]') throw new Error('Scope capture requires an exact same-origin application bundle URL')
  if (!/^[a-f0-9]{64}$/.test(capture.sha256) || !Number.isInteger(capture.lineNumber) || capture.lineNumber < 0 ||
    !Number.isInteger(capture.columnNumber) || capture.columnNumber < 0) throw new Error('Invalid exact-script breakpoint identity')
  if (capture.frameIndex != null && (!Number.isInteger(capture.frameIndex) || capture.frameIndex < 0 || capture.frameIndex > 20)) throw new Error('Invalid bounded scope frame index')
  // Expressions are deliberately fixed by the helper; actual lexical symbol
  // names come from reviewed minified source, not arbitrary executable input.
  const names = capture.bindings || {}
  for (const value of Object.values(names)) if (!/^[A-Za-z_$][\w$]*$/.test(value)) throw new Error('Invalid scope binding name')
  const allowed = ['cursor', 'getterIndex', 'historyDelta', 'nextIndex', 'currentIndex', 'path', 'pendingPath', 'pending', 'items']
  if (Object.keys(names).some(key => !allowed.includes(key))) throw new Error('Unsupported scope binding')
  const summaries = ['cursor', 'getterIndex', 'historyDelta', 'nextIndex', 'currentIndex']
    .filter(key => names[key]).map(key => `${JSON.stringify(key)}:typeof ${names[key]}==='number'?${names[key]}:null`)
  if (names.pending) summaries.push(`pendingLength:Array.isArray(${names.pending})?${names.pending}.length:null`)
  if (names.items) summaries.push(`items:Array.isArray(${names.items})?${names.items}.slice(0,40).map(x=>({id:x?.id??null,path:typeof x?.path==='string'?x.path:null})):null`)
  for (const key of ['path', 'pendingPath']) if (names[key]) summaries.push(`${key}:typeof ${names[key]}==='string'?${names[key]}:null`)
  if (names.path && names.pendingPath) summaries.push(`rawPathEqualsPending:${names.path}===${names.pendingPath}`)
  const scripts = []
  const onScript = event => scripts.push(event)
  trace.cdp.on('Debugger.scriptParsed', onScript)
  // Debugger.enable already ran; known scripts can be obtained again without
  // altering application state by disabling/re-enabling the debugger domain.
  try { await trace.cdp.send('Debugger.disable'); await trace.cdp.send('Debugger.enable') }
  finally { trace.cdp.off('Debugger.scriptParsed', onScript) }
  const script = scripts.find(item => item.url === capture.url)
  if (!script) throw new Error('Breakpoint bundle was not loaded before arming capture')
  const source = await trace.cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId })
  if (crypto.createHash('sha256').update(source.scriptSource).digest('hex') !== capture.sha256) throw new Error('Breakpoint bundle bytes changed')
  const { breakpointId } = await trace.cdp.send('Debugger.setBreakpoint', { location: { scriptId: script.scriptId,
    lineNumber: capture.lineNumber, columnNumber: capture.columnNumber } })
  let armed = false
  let captured = false
  let failure = null
  let pending = Promise.resolve()
  const onPause = event => {
    pending = (async () => {
      try {
        if (armed && !captured && event.hitBreakpoints?.includes(breakpointId)) {
          captured = true
          const selected = event.callFrames[capture.frameIndex || 0]
          if (!selected) throw new Error('Requested scope frame is absent')
          const result = await trace.cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: selected.callFrameId,
            expression: `({${summaries.join(',')}})`, returnByValue: true, throwOnSideEffect: true })
          if (result.exceptionDetails) throw new Error('Reviewed scope bindings unavailable in this frame')
          const summary = result.result.value
          for (const key of ['path', 'pendingPath']) if (summary[key] != null) summary[key] = trace.sanitize(summary[key])
          if (summary.items) summary.items = summary.items.map(item => ({ id: item.id, path: item.path == null ? null : trace.sanitize(item.path) }))
          await emit({ frames: event.callFrames.slice(0, 24).map(frame => ({ functionName: frame.functionName,
            scriptId: frame.location.scriptId, lineNumber: frame.location.lineNumber, columnNumber: frame.location.columnNumber })), summary })
        }
      } catch (error) { failure = error }
      finally { await trace.cdp.send('Debugger.resume').catch(() => {}) }
    })()
  }
  trace.cdp.on('Debugger.paused', onPause)
  return { arm() { armed = true }, async stop() {
    await pending; trace.cdp.off('Debugger.paused', onPause)
    await trace.cdp.send('Debugger.removeBreakpoint', { breakpointId }).catch(() => {})
    if (failure) throw failure
    return captured
  } }
}

module.exports = { createPathSanitizer, safeScriptUrl, installHistoryObserver, observeBrowserHistory, armScopeCapture }
