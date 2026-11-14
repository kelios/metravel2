const fs = require('node:fs')
const path = require('node:path')
const { expect, devices } = require('@playwright/test')
const { createPathSanitizer, observeBrowserHistory, armScopeCapture } = require('./browserHistoryTrace')
const { identity, ownsTravel, snapshot, ROOT } = require('../prod-probe/travelEditorFixtures')

let ru
function label(key) {
  if (!ru) {
    ru = {}
    const localeRoot = path.join(ROOT, 'i18n/locales/ru')
    const files = ['generated', 'static'].flatMap(directory => fs.readdirSync(path.join(localeRoot, directory))
      .filter(name => name.endsWith('.ts')).map(name => path.join(localeRoot, directory, name)))
    files.push(path.join(localeRoot, 'common.ts'))
    for (const filename of files) {
      for (const match of fs.readFileSync(filename, 'utf8').matchAll(/^\s*['"]([^'"]+)['"]:\s*("(?:[^"\\]|\\.)*")/gm)) ru[match[1]] = JSON.parse(match[2])
    }
  }
  if (!ru[key]) throw new Error(`Required RU selector translation missing: ${key}`)
  return ru[key]
}
const selectors = {
  edit: 'components.listTravel.TravelListItem.redaktirovat_2e33442a',
  myTravels: 'components.layout.AccountMenu.moi_puteshestviya_a530e844',
  travels: 'components.layout.AccountMenu.puteshestviya_28956c1f',
  menu: 'components.layout.CustomHeaderMobileAccountSection.otkryt_menyu_e43b6ae3',
  draftFound: 'components.travel.DraftRecoveryDialog.nayden_lokalnyy_chernovik_0dd4d86c',
}
function traceConfig(reg) {
  return { origin: reg.origin, travelIds: reg.fixtures.map(fixture => fixture.id), slugs: reg.fixtures.map(fixture => fixture.slug).filter(Boolean),
    userIds: Object.values(reg.accounts).map(account => account.id) }
}
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
function observeReadOnly(context, reg, expected404 = []) {
  const safe = createPathSanitizer(traceConfig(reg))
  const data = { writes: [], errors: [], failedRequests: [], badResponses: [] }
  // A local stack is a copy of production rows whose old media stays in S3, so
  // their images fail locally (AGENTS.md, local stack contract): 404, or 503 when
  // the backend's lookup of the absent file times out under machine load. That
  // is a limitation of the copy: reported in `localCopyMissingMedia`, not an app
  // error. Only images qualify; a production origin keeps every status strict.
  const localCopy = LOOPBACK_HOSTS.has(new URL(reg.origin).hostname)
  const localCopyMissingMedia = new Set()
  const pending404Console = []
  const abortedReads = []
  const pendingAborts = []
  const requestPageUrl = new WeakMap()
  const frameNavigations = []
  const DEPARTURE_WINDOW_MS = 1000
  const watched = new Map()
  const pending = new Set()
  let lastActivity = Date.now()
  const activity = () => { lastActivity = Date.now() }
  const safeText = text => String(text).replace(/https?:\/\/[^\s"'<>]+/g, value => safe(value).path)
    .replace(/\b(?:authorization|cookie|token|password)\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
  const watchPage = page => {
    const onError = error => { activity(); data.errors.push({ kind: 'pageerror', message: safeText(error.message) }) }
    const onConsole = message => {
      if (message.type() !== 'error') return
      const location = message.location()
      // Chromium's failed-resource console for the explicitly expected denial
      // is network evidence. React/application errors are never filtered.
      let expectedResource = false
      try {
        const source = new URL(location.url)
        expectedResource = source.origin === reg.origin && expected404.includes(source.pathname)
      } catch { /* An absent/invalid location cannot establish an expected denial. */ }
      const resource404 = /^Failed to load resource: the server responded with a status of 404\b/.test(message.text())
      const resourceMissing = /^Failed to load resource: the server responded with a status of (?:404|503)\b/.test(message.text())
      if (resource404 && expectedResource) return
      const entry = { kind: 'console', message: safeText(message.text()), location: safe(location.url).path }
      activity()
      // Matched against image 404 responses in assertClean (event order is not guaranteed).
      if (resourceMissing && localCopy) pending404Console.push({ entry, url: location.url })
      else data.errors.push(entry)
    }
    const onNavigated = frame => { if (frame === page.mainFrame()) frameNavigations.push({ page, url: frame.url(), at: Date.now() }) }
    page.on('pageerror', onError); page.on('console', onConsole); page.on('framenavigated', onNavigated)
    watched.set(page, { onError, onConsole, onNavigated })
  }
  context.pages().forEach(watchPage); context.on('page', watchPage)
  const onRequest = request => {
    try { requestPageUrl.set(request, request.frame().url()) } catch { /* A service-worker request has no frame. */ }
    const url = new URL(request.url())
    if (url.origin !== reg.origin) return
    if (url.pathname.startsWith('/api/')) { pending.add(request); activity() }
    if (/^\/api\/(?:travels(?:\/|$)|upload(?:\/|$))/.test(url.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      data.writes.push({ method: request.method(), path: safe(request.url()).path, startedAt: Date.now() })
    }
  }
  const onResponse = response => {
    const url = new URL(response.url())
    if (localCopy && url.origin === reg.origin && [404, 503].includes(response.status()) && response.request().resourceType() === 'image') {
      localCopyMissingMedia.add(url.href)
      return
    }
    if (url.origin === reg.origin && response.status() >= 400 && !(response.status() === 404 && expected404.includes(url.pathname))) {
      data.badResponses.push({ status: response.status(), path: safe(response.url()).path })
    }
  }
  const onFinished = request => { if (pending.delete(request)) activity() }
  const onFailed = request => {
    pending.delete(request); activity()
    const error = request.failure()?.errorText || ''
    // A same-origin read the app cancels because the user left its screen (e.g. the
    // home «route of the month» on a quick in-app navigation) is a client
    // cancellation, not a failure. The screen unmounts just before history.pushState,
    // so a departure is the same page navigating away from the request's URL within
    // DEPARTURE_WINDOW_MS of the abort; decided in assertClean once events settle.
    // A read aborted on a screen that stays, aborted writes and other errors stay strict.
    const failure = { path: safe(request.url()).path, error: safeText(error) }
    let page = null
    try { page = request.frame().page() } catch { /* No frame: cannot prove a departure. */ }
    if (error === 'net::ERR_ABORTED' && ['GET', 'HEAD'].includes(request.method()) && page &&
        new URL(request.url()).origin === reg.origin && requestPageUrl.has(request)) {
      pendingAborts.push({ failure, page, startedOn: requestPageUrl.get(request), at: Date.now() })
      return
    }
    data.failedRequests.push(failure)
  }
  context.on('request', onRequest); context.on('response', onResponse); context.on('requestfailed', onFailed); context.on('requestfinished', onFinished)
  return { data,
    // Tolerated, not hidden: the raw trace keeps both lists beside `data`.
    tolerated: () => ({ localCopyMissingMedia: [...localCopyMissingMedia].map(href => safe(href).path), abortedReads: [...abortedReads],
      unclassifiedAborts: pendingAborts.map(abort => abort.failure.path) }),
    async settle() {
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        if (pending.size === 0 && Date.now() - lastActivity >= 500) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error('Observed read-only request/error lifecycle did not become quiet within5s')
    },
    assertClean() {
      for (const { entry, url } of pending404Console.splice(0)) if (!localCopyMissingMedia.has(url)) data.errors.push(entry)
      for (const abort of pendingAborts.splice(0)) {
        const departed = frameNavigations.some(nav => nav.page === abort.page && nav.url !== abort.startedOn &&
          Math.abs(nav.at - abort.at) <= DEPARTURE_WINDOW_MS)
        if (departed) abortedReads.push(abort.failure.path)
        else data.failedRequests.push(abort.failure)
      }
      for (const [kind, entries] of Object.entries(data)) expect(entries, `read-only ${kind}`).toEqual([])
    },
    stop() {
      context.off('page', watchPage); context.off('request', onRequest); context.off('response', onResponse); context.off('requestfailed', onFailed); context.off('requestfinished', onFinished)
      for (const [page, handlers] of watched) { page.off('pageerror', handlers.onError); page.off('console', handlers.onConsole); page.off('framenavigated', handlers.onNavigated) }
    },
  }
}
async function openRoleContext(browser, batch, role, width) {
  const viewport = { width, height: width === 390 ? 844 : 900 }
  // #2928: модуль грузит и обычный node (e2e/prod-probe), он не читает
  // helpers/mobileProfile.ts — профиль тот же, `screen` = viewport задан явно.
  const options = { baseURL: batch.reg.origin, viewport, hasTouch: width === 390, isMobile: width === 390, deviceScaleFactor: width === 390 ? 3 : 1,
    ...(width === 390 ? { screen: viewport, userAgent: devices['Pixel 7'].userAgent } : {}),
    locale: 'ru-RU', storageState: role === 'guest' ? { cookies: [], origins: [] } : role === 'admin' ? await batch.admin.context.storageState() : batch.stateFile(role) }
  const context = await browser.newContext(options)
  if (role !== 'guest') await identity(context.request, role === 'admin' ? 104 : batch.reg.accounts[role].id, role === 'admin')
  await context.addInitScript(origin => {
    if (location.origin !== origin) return
    try { localStorage.setItem('@metravel/locale-preference:v1', JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' })) } catch { /* Opaque or restricted storage is not an auth fallback. */ }
  }, batch.reg.origin)
  const page = await context.newPage()
  return { context, page }
}
async function wizard(page, fixture) {
  await expect(page).toHaveURL(url => url.pathname === `/travel/${fixture.id}`)
  const root = page.locator('[data-testid="travel-upsert.root"]:visible')
  await expect(root).toHaveCount(1)
  await expect(root.getByTestId('travel-wizard-header')).toBeVisible()
  return root
}
async function ownListRow(page, fixture) {
  await expect(page).toHaveURL(url => url.pathname === '/metravel')
  // The web list also keeps hidden layout copies of each card (zero-size,
  // display:none); the user sees exactly one, so count only the visible card.
  const card = page.getByTestId(`travel-card-${fixture.slug || fixture.id}`).filter({ visible: true })
  await expect(card).toHaveCount(1)
  await expect(card.getByText(fixture.name, { exact: true })).toBeVisible()
  return card
}
const isDetailGet = fixture => request => request.method() === 'GET' && new URL(request.url()).pathname === `/api/travels/${fixture.id}/`
// Every Edit from the list opens a new editor session and reads the article: the
// first visit, and a repeat one after the wizard was left by its own exit (#3400).
async function actualEdit(page, fixture, reg) {
  const card = await ownListRow(page, fixture)
  const mobile = page.viewportSize().width === 390
  const unit = card.locator(mobile
    ? 'xpath=ancestor::*[./*[@data-testid="travel-moderation-feedback"] and .//*[@data-testid="admin-actions"]][1]'
    : 'xpath=ancestor::*[@data-travel-card-hover="true"][1]')
  await expect(unit).toHaveCount(1)
  const control = unit.getByTestId('admin-actions').getByRole('button', { name: label(selectors.edit), exact: true })
  await expect(control).toHaveCount(1); await expect(control).toBeVisible()
  const detailGet = isDetailGet(fixture)
  const responsePromise = page.waitForResponse(response => detailGet(response.request()))
  const [response] = await Promise.all([responsePromise, control.click()])
  expect(response.status(), 'actual Edit detail GET').toBe(200)
  const dto = await response.json()
  expect(ownsTravel(dto, fixture, reg), 'actual Edit exact owned object').toBe(true)
  await wizard(page, fixture)
  return snapshot(dto)
}
async function selectStep(page, fixture, number) {
  const root = await wizard(page, fixture), picker = root.getByTestId('travel-wizard-step-select')
  const name = new RegExp(`^${label('components.travel.TravelWizardHeader.pereyti_k_shagu_value1_value2_01355266').replace('{{value1}}', String(number)).split('{{value2}}')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  if (await picker.isVisible()) {
    await picker.click()
    if (page.viewportSize().width === 390) await page.getByTestId('bottom-sheet-panel').getByRole('button', { name }).click()
    else await root.getByTestId(`travel-wizard-step-select-option-${number}`).click()
    await expect(picker).toContainText(`${number}/6`)
  } else await root.getByTestId('travel-wizard-header').getByRole('button', { name }).click()
  await expect(page.getByTestId('bottom-sheet-panel')).toHaveCount(0)
}
async function exerciseReason(page, fixture) {
  await selectStep(page, fixture, 6)
  const root = await wizard(page, fixture), open = root.getByTestId('moderation-reason-expand')
  await expect(root.getByTestId('moderation-reason-preview')).toHaveText(fixture.before.moderation_decision_reason)
  for (let attempt = 0; attempt < 2; attempt++) {
    await open.click()
    await expect(page.getByTestId('info-sheet-body')).toHaveText(fixture.before.moderation_decision_reason)
    await page.getByTestId('bottom-sheet-panel').getByRole('button', { name: label('action.close'), exact: true }).click()
    await expect(page.getByTestId('bottom-sheet-panel')).toHaveCount(0)
  }
}
async function accountDestination(page, destination) {
  const mobile = page.viewportSize().width === 390
  if (mobile) {
    // #2779: «Профиль» — пункт нижнего дока; «Мои путешествия» — секция аккаунта
    // листа «Ещё», который открывает кнопка меню шапки.
    if (destination === 'profile') {
      await page.getByTestId('footer-item-favorites').click()
    } else {
      // Every visited tab keeps its own header mounted (#2910); only the focused
      // screen's copy is in the accessibility tree, so select it by role.
      await page.getByRole('button', { name: label(selectors.menu), exact: true }).click()
      const sheet = page.getByTestId('footer-more-sheet')
      await expect(sheet).toBeVisible()
      await page.getByTestId('footer-more-item-my-travels').click()
      await expect(sheet).toHaveCount(0)
    }
  } else {
    await page.locator('#main-navigation').getByTestId('account-menu-anchor').click()
    if (destination === 'travels') await page.getByRole('button', { name: label(selectors.travels), exact: true }).click()
    await page.getByRole('link', { name: destination === 'profile' ? /^Личный кабинет/ : label(selectors.myTravels) }).click()
  }
  await expect(page).toHaveURL(url => url.pathname === (destination === 'profile' ? '/profile' : '/metravel'))
}
async function enterList(page, origin, depth) {
  if (depth === 'zero') { await page.goto(`${origin}/metravel`, { waitUntil: 'domcontentloaded' }); return }
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  const timeOrigin = await page.evaluate(() => performance.timeOrigin)
  await accountDestination(page, 'profile')
  const home = page.viewportSize().width === 390 ? page.getByTestId('footer-item-home') :
    page.getByTestId('main-header').getByRole('link', { name: 'Маршруты', exact: true }).first()
  await expect(home).toBeVisible(); await home.click()
  await expect(page).toHaveURL(url => url.pathname === '/search')
  await accountDestination(page, 'travels')
  expect(await page.evaluate(() => performance.timeOrigin), 'real predecessor controls must remain in one app document').toBe(timeOrigin)
}
async function stableRestoration(page, trace, entry, entries, fixture, observation) {
  await ownListRow(page, fixture)
  await expect(page.getByTestId('info-sheet-body')).toHaveCount(0)
  await expect.poll(() => trace.readHistory(), { timeout: 10_000, message: 'restore original browser entry/document, not a transient path' })
    .toEqual({ ...entry, entries })
  await observation.settle()
  // A bounded500ms quiet window extends past the dependency's100ms traversal
  // continuation. This measures stability; it is never a product fix/retry.
  await expect.poll(() => trace.readHistory()).toEqual({ ...entry, entries })
}

async function runEditorHistory({ context, page, batch, width, temperature, editorState, depth = 'nonzero', emit, write, capture }) {
  const reg = batch.reg, fixture = reg.fixtures.find(item => item.label === 'private-long')
  expect(fixture, 'real private-long fixture exists').toBeTruthy()
  const observation = observeReadOnly(context, reg)
  const trace = await observeBrowserHistory(context, page, traceConfig(reg))
  let scope
  let failure
  let collectionFailure
  try {
    await enterList(page, reg.origin, depth)
    await ownListRow(page, fixture)
    if (temperature === 'warm') {
      await actualEdit(page, fixture, reg)
      await page.getByTestId('travel-wizard-back').filter({ visible: true }).click()
      await ownListRow(page, fixture)
      await observation.settle()
    }
    const list = await trace.readHistory()
    if (depth === 'nonzero') expect(list.currentIndex, 'genuine prior in-app entries before Edit').toBeGreaterThan(1)
    const before = await actualEdit(page, fixture, reg)
    if (editorState === 'step6') await exerciseReason(page, fixture)
    else {
      await expect(page.getByTestId('info-sheet-body')).toHaveCount(0)
      await expect((await wizard(page, fixture)).locator('#field-name').getByRole('textbox')).toHaveValue(fixture.name)
    }
    const editor = await trace.readHistory()
    expect(editor.timeOrigin).toBe(list.timeOrigin)
    expect(editor.currentIndex).toBe(list.currentIndex + 1)
    expect(editor.stateId).not.toBe(list.stateId)
    await emit({ phase: 'before-native-back', width, temperature, editorState, depth, list, editor })
    if (capture) scope = await armScopeCapture(trace, capture, summary => emit({ phase: 'paused-extra-traversal', timingPerturbed: true, ...summary }))
    const boundary = trace.command('native-browser-back')
    scope?.arm()
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await stableRestoration(page, trace, list, editor.entries, fixture, observation)
    const afterBack = trace.entries.slice(boundary)
    expect(afterBack.filter(entry => entry.kind === 'history-call-before' && ['go', 'back', 'forward'].includes(entry.method)), 'native Back must cause zero additional app traversals').toEqual([])
    expect(afterBack.filter(entry => entry.kind === 'popstate'), 'one native Back produces one popstate').toHaveLength(1)
    expect(afterBack.filter(entry => entry.kind === 'document-request'), 'browser Back retains the document').toEqual([])
    const forwardBoundary = trace.command('native-browser-forward')
    await page.goForward({ waitUntil: 'domcontentloaded' })
    await wizard(page, fixture); await observation.settle()
    await expect.poll(() => trace.readHistory()).toEqual(editor)
    expect(trace.entries.slice(forwardBoundary).filter(entry => entry.kind === 'history-call-before' && ['go', 'back', 'forward'].includes(entry.method)), 'Forward must not trigger a corrective traversal').toEqual([])
    const actual = await batch.ownDetail(context.request, fixture)
    expect(snapshot(actual), 'navigation must not save/change the article').toEqual(before)
    expect(trace.entries.filter(entry => entry.kind === 'observer-error'), 'history observation did not lose calls').toEqual([])
    observation.assertClean()
    await emit({ phase: 'history-business-assertions', width, temperature, editorState, depth, verdict: 'PASS' })
  } catch (error) { failure = error }
  finally {
    try {
      if (scope) {
        try { await emit({ phase: 'scope-capture-complete', captured: await scope.stop() }) } catch (error) { collectionFailure = error }
      }
      let scripts = []
      try { scripts = await trace.sources(write) } catch (error) { collectionFailure ||= error }
      await emit({ phase: 'history-raw-trace', width, temperature, editorState, depth, entries: trace.entries, scripts, observations: observation.data, tolerated: observation.tolerated(),
        failed: Boolean(failure), collectionFailed: Boolean(collectionFailure) })
      if (!page.isClosed()) {
        try { await page.screenshot({ path: path.join(batch.directory, `history-${width}-${temperature}-${editorState}-${depth}.png`), fullPage: false }) } catch (error) { collectionFailure ||= error }
      }
    } catch (error) { collectionFailure ||= error }
    finally { observation.stop(); await trace.stop() }
  }
  if (failure) throw failure
  if (collectionFailure) throw collectionFailure
}

// #3400: «Выйти без сохранения» ends the editor session. The tab screen stays
// mounted on web, so the discarded form used to live on behind the list: its
// autosave sent the edits one debounce later, and a repeat Edit reopened them
// without reading the article.
const AUTOSAVE_DEBOUNCE_MS = 5000
async function runEditorDiscard({ context, page, batch, width, emit }) {
  const reg = batch.reg, fixture = reg.fixtures.find(item => item.label === 'private-long')
  expect(fixture, 'real private-long fixture exists').toBeTruthy()
  const observation = observeReadOnly(context, reg)
  const nameField = async () => (await wizard(page, fixture)).locator('#field-name').getByRole('textbox')
  const exit = () => page.getByTestId('travel-wizard-back').filter({ visible: true }).click()
  try {
    await enterList(page, reg.origin, 'zero')
    const before = await actualEdit(page, fixture, reg)
    await expect(await nameField()).toHaveValue(fixture.name)
    await (await nameField()).fill(`${fixture.name} — отброшено`)
    await exit()
    await page.getByTestId('travel-wizard.exit.discard').click()
    await ownListRow(page, fixture)
    // A bounded window past the autosave debounce: the absence of a write is the
    // assertion, and only elapsed time can show it.
    await new Promise(resolve => setTimeout(resolve, AUTOSAVE_DEBOUNCE_MS + 1500))
    await observation.settle()
    expect(observation.data.writes, 'discarded edits never reach the server').toEqual([])

    expect(await actualEdit(page, fixture, reg), 'repeat Edit reads the unchanged server article').toEqual(before)
    await expect(await nameField()).toHaveValue(fixture.name)
    // The draft lookup is asynchronous: its dialog is judged only once the page is quiet.
    await observation.settle()
    await expect(page.getByLabel(label(selectors.draftFound), { exact: true }), 'no draft of the discarded edits is offered').toHaveCount(0)
    // Nothing is unsaved in the new session: its exit asks no question.
    await exit()
    await ownListRow(page, fixture)
    await expect(page.getByTestId('travel-wizard.exit.discard')).toHaveCount(0)
    expect(snapshot(await batch.ownDetail(context.request, fixture)), 'the article is unchanged').toEqual(before)
    await observation.settle(); observation.assertClean()
    await emit({ phase: 'discard-business-assertions', width, verdict: 'PASS' })
  } finally {
    try {
      await emit({ phase: 'discard-raw-trace', width, observations: observation.data, tolerated: observation.tolerated() })
      if (!page.isClosed()) await page.screenshot({ path: path.join(batch.directory, `discard-${width}.png`), fullPage: false })
    } finally { observation.stop() }
  }
}

// Shared real-document acceptance for #2701. Fixture setup and teardown remain
// outside this read-only phase; the actual server chooses404/200/301.
async function runEditorDocument({ context, page, batch, role, width, temperature, emit }) {
  const fixture = batch.reg.fixtures.find(item => item.label === 'private-long')
  const denied = role === 'guest' || role === 'other'
  const target = `/travel/${fixture.id}`, apiPath = `/api/travels/${fixture.id}/`
  const observation = observeReadOnly(context, batch.reg, denied ? [target, apiPath] : [])
  try {
    if (temperature === 'warm') {
      await page.goto(`${batch.reg.origin}/travel/new`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('travel-wizard-header')).toBeVisible()
    }
    const response = await page.goto(`${batch.reg.origin}${target}`, { waitUntil: 'domcontentloaded' })
    expect(response.status()).toBe(denied ? 404 : 200)
    const headers = response.headers(), html = await response.text()
    expect(headers['cache-control']).toMatch(/no-store/i)
    if (denied) {
      expect(headers['cache-control']).toMatch(/private/i)
      expect(html).toContain('static-not-found')
      expect(html).not.toContain(fixture.before.moderation_decision_reason)
      await expect(page.locator('#static-not-found')).toBeVisible()
      await expect(page.getByTestId('travel-upsert.root')).toHaveCount(0)
      expect(await page.locator('body').innerText()).not.toContain(fixture.before.moderation_decision_reason)
    } else {
      expect(headers['x-robots-tag']).toMatch(/noindex.*nofollow/i)
      await wizard(page, fixture)
    }
    expect((await context.request.get(`${batch.reg.origin}${apiPath}`)).status()).toBe(denied ? 404 : 200)
    await observation.settle(); observation.assertClean()
    await expect(page).toHaveURL(`${batch.reg.origin}${target}`)
    await page.screenshot({ path: path.join(batch.directory, `document-${role}-${width}-${temperature}.png`), fullPage: false })
    await emit({ phase: 'editor-document', role, width, temperature, status: response.status(), observations: observation.data, tolerated: observation.tolerated(), verdict: 'PASS' })
  } finally { observation.stop() }
}

module.exports = { label, traceConfig, observeReadOnly, openRoleContext, actualEdit, selectStep, exerciseReason, enterList,
  runEditorHistory, runEditorDiscard, runEditorDocument }
