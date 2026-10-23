import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'

jest.mock('@playwright/test', () => ({ request: {}, expect: {}, devices: { 'Pixel 7': { userAgent: 'unit-mobile-agent' } } }))
jest.mock('playwright', () => ({ chromium: {}, request: {} }))
jest.mock('../../scripts/e2e-env-files', () => ({ applyEnvFile: jest.fn() }))
const { createPathSanitizer, installHistoryObserver, armScopeCapture } = require('../../e2e/helpers/browserHistoryTrace')
const { targetConfig, validateRegistry, ownsTravel, commandPayload, reasonFor, openOwnedBatch, writePrivate } = require('../../e2e/prod-probe/travelEditorFixtures')
const { parseOptions, cellsFor } = require('../../e2e/prod-probe/editorRegression')
const { label, openRoleContext } = require('../../e2e/helpers/editorFixtureBrowser')
const origin = 'https://metravel.by'
const config = { origin, travelIds: [42], slugs: ['qa-public'], userIds: [900] }

describe('editor diagnostic observation and owned-fixture boundaries', () => {
  it('keeps allowed full returnTo/hash while redacting nested secrets without conflating equality', () => {
    const safe = createPathSanitizer(config)
    const permitted = '/travel/42?returnTo=%2Fmetravel%3Fpage%3D2%23top#publish'
    expect(safe(permitted).path).toBe(permitted)
    const first = safe('/travel/42?returnTo=%2Fmetravel%3Ftoken%3Dsecret-one')
    const second = safe('/travel/42?returnTo=%2Fmetravel%3Ftoken%3Dsecret-two')
    expect(first.path).toBe(second.path)
    expect(first.equalityId).not.toBe(second.equalityId)
    expect(safe('/travel/42?returnTo=%2Fmetravel%3Ftoken%3Dsecret-one').equalityId).toBe(first.equalityId)
    expect(JSON.stringify([first, second])).not.toMatch(/secret-(one|two)/)
    expect(safe('/travel/42?returnTo=https%3A%2F%2Fevil.example%2F#private-email').path).toBe('/travel/42?_redacted=1#redacted')
    expect(safe('/travel/99').path).toBe('[redacted-path]')
  })

  it('observes native calls without changing this, arguments, return, exceptions or descriptor enumeration', async () => {
    const records: unknown[] = [], calls: unknown[] = []
    const failure = new Error('native failure')
    const history = { state: { id: 'entry-1', cookie: 'never-capture' }, length: 2 }
    for (const method of ['go', 'back', 'forward', 'pushState', 'replaceState']) Object.defineProperty(history, method, {
      configurable: true, enumerable: false, writable: true,
      value: function (...args: unknown[]) { calls.push({ method, self: this === history, args }); if (args[0] === 99) throw failure; return 17 },
    })
    const window = { __editorHistoryRecord: async (entry: unknown) => { records.push(entry) } }
    const sandbox = { window, history, location: { href: `${origin}/travel/42` }, URL, URLSearchParams,
      performance: { now: () => 4, timeOrigin: 123 }, addEventListener: jest.fn(), config }
    vm.runInNewContext(`(${installHistoryObserver})(config, ${createPathSanitizer})`, sandbox)
    expect((history as any).go(-1)).toBe(17)
    expect(() => (history as any).go(99)).toThrow(failure)
    expect(calls).toEqual([{ method: 'go', self: true, args: [-1] }, { method: 'go', self: true, args: [99] }])
    expect(Object.getOwnPropertyDescriptor(history, 'go')?.enumerable).toBe(false)
    expect(JSON.stringify(records)).not.toContain('never-capture')
    expect(records).toHaveLength(5)
  })

  it('rejects protected/foreign cleanup identities and a mismatched article owner', () => {
    const registry = { version: 1, runId: 'run-unit', marker: 'QAEDITOR-unit', origin, backendUrl: `${origin}/api`,
      accounts: { author: { id: 900, name: 'QAEDITOR-unit-author' } }, fixtures: [{ id: 42, label: 'private-long', name: 'QAEDITOR-unit private-long' }] }
    expect(() => validateRegistry(registry, 'run-unit')).not.toThrow()
    expect(() => validateRegistry({ ...registry, accounts: { author: { id: 104, name: 'QAEDITOR-unit-author' } } }, 'run-unit')).toThrow(/Protected/)
    expect(() => validateRegistry({ ...registry, marker: "QAEDITOR-bad'" }, 'run-unit')).toThrow(/Foreign/)
    expect(ownsTravel({ id: 42, name: 'QAEDITOR-unit private-long', userIds: '1' }, registry.fixtures[0], registry)).toBe(false)
    expect(() => targetConfig('http://localhost:8085', 'https://metravel.by/api')).toThrow(/loopback/)
  })

  it('does not coerce URL objects or invoke state getters before the native call', () => {
    const records: unknown[] = []
    let stateReads = 0, urlReads = 0
    const data = { get id() { stateReads++; return 'entry-next' } }
    const target = { toString() { urlReads++; return '/metravel' } }
    const history: any = { state: { id: 'entry-current' }, length: 2 }
    for (const method of ['go', 'back', 'forward', 'pushState', 'replaceState']) history[method] = () => {}
    history.pushState = function (value: typeof data, _title: string, url: typeof target) {
      expect(stateReads).toBe(0)
      expect(urlReads).toBe(0)
      return `${value.id}:${url}`
    }
    const window = { __editorHistoryRecord: async (entry: unknown) => { records.push(entry) } }
    vm.runInNewContext(`(${installHistoryObserver})(config, ${createPathSanitizer})`, { window, history,
      location: { href: `${origin}/travel/42` }, URL, URLSearchParams, performance: { now: () => 4, timeOrigin: 123 }, addEventListener: jest.fn(), config })
    expect(history.pushState(data, '', target)).toBe('entry-next:/metravel')
    expect(stateReads).toBe(1)
    expect(urlReads).toBe(1)
    expect(records).toHaveLength(3)
  })

  it('refuses scope capture on a foreign or non-application script before debugger work', async () => {
    const cdp = { send: jest.fn() }
    const capture = { sha256: 'a'.repeat(64), lineNumber: 1, columnNumber: 1 }
    for (const url of ['https://foreign.example/_expo/static/js/web/entry.js', `${origin}/api/user/me/`]) {
      await expect(armScopeCapture({ origin, cdp }, { ...capture, url }, jest.fn())).rejects.toThrow(/same-origin application/)
    }
    expect(cdp.send).not.toHaveBeenCalled()
  })

  it('uses a mobile UA along with touch/mobile/DPR rather than a narrow desktop context', async () => {
    const page = {}, context = { addInitScript: jest.fn(), newPage: jest.fn(async () => page) }
    const browser = { newContext: jest.fn(async (_options: Record<string, unknown>) => context) }
    const batch = { reg: { origin } }
    await expect(openRoleContext(browser, batch, 'guest', 390)).resolves.toEqual({ context, page })
    expect(browser.newContext).toHaveBeenLastCalledWith(expect.objectContaining({
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, userAgent: 'unit-mobile-agent',
      storageState: { cookies: [], origins: [] },
    }))
    await openRoleContext(browser, batch, 'guest', 1440)
    expect(browser.newContext.mock.calls[1][0]).toEqual(expect.objectContaining({
      viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, deviceScaleFactor: 1,
    }))
    expect(browser.newContext.mock.calls[1][0]).not.toHaveProperty('userAgent')
  })

  it('uses real canonical commands without echoing readonly history, and validates rejection bounds', () => {
    const current = { publication_status: 'draft', name: 'own', publish: true, moderation: true,
      moderation_decision: 'rejected', moderation_decision_reason: 'old', moderation_decided_at: 'date' }
    expect(commandPayload(current, 'submit')).toEqual({ name: 'own', publication_status: 'pending_review', enforce_moderation_validation: true })
    expect(commandPayload(current, 'approve')).toEqual({ name: 'own', publication_status: 'published', enforce_moderation_validation: false })
    expect(commandPayload(current, 'reject', ' new ')).toEqual({ name: 'own', publication_status: 'draft', enforce_moderation_validation: false, moderation_decision_reason: 'new' })
    expect(reasonFor('QAEDITOR-unit')).toHaveLength(2000)
    expect(() => commandPayload(current, 'reject', '  ')).toThrow(/Invalid/)
    expect(() => commandPayload(current, 'reject', 'x'.repeat(2001))).toThrow(/Invalid/)
  })

  it('selects nonzero bounded cells and refuses implicit/unknown/zero-scope execution', () => {
    const args = ['--execute', '--phase=diagnostic', '--width=1440', '--temperature=cold', '--editor-state=step1', '--depth=nonzero', `--sha=${'a'.repeat(40)}`, '--run-id=run-unit']
    expect(cellsFor(parseOptions(args))).toEqual([{ width: 1440, temperature: 'cold', editorState: 'step1', depth: 'nonzero' }])
    expect(() => parseOptions(args.filter(arg => arg !== '--execute'))).toThrow(/Explicit/)
    expect(() => parseOptions([...args, '--unknown=1'])).toThrow(/Unknown/)
    expect(() => parseOptions(args.map(arg => arg === '--width=1440' ? '--width=all' : arg))).toThrow(/one bounded/)
    for (const key of ['action.close', 'components.layout.AccountMenu.moi_puteshestviya_a530e844', 'components.listTravel.TravelListItem.redaktirovat_2e33442a']) expect(label(key)).toBeTruthy()
  })

  it.each([new Error('missing storage file'), new SyntaxError('invalid storage JSON')])('recovers an owned activated account when context construction rejects: %s', async failure => {
    const runId = `run-unit-recovery-${process.pid}-${Date.now()}`
    const name = 'QAEDITOR-unit-author'
    const reg = { version: 1, runId, marker: 'QAEDITOR-unit', origin, backendUrl: `${origin}/api`,
      accounts: { author: { id: 900, name, activated: true, deleted: false } }, fixtures: [], ledger: [] }
    const response = { ok: () => true, status: () => 200, json: async () => ({ id: 900, name, is_superuser: false }) }
    const recovery = { post: jest.fn(async () => response), get: jest.fn(async () => response), dispose: jest.fn(),
      storageState: jest.fn(async () => ({ cookies: [{ name: 'authToken', value: 'unit-cookie', httpOnly: true, domain: 'metravel.by' }], origins: [] })) }
    const request = require('@playwright/test').request
    request.newContext = jest.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(recovery)
    const batch = await openOwnedBatch({ baseUrl: origin, runId, initialRegistry: reg })
    const credentials = { email: 'owned-unit@example.test', password: 'unit-only' }
    writePrivate(path.join(batch.directory, 'author.credentials.private.json'), credentials)
    try {
      await expect(batch.authorApi()).resolves.toBe(recovery)
      expect(request.newContext).toHaveBeenNthCalledWith(1, { baseURL: origin, storageState: batch.stateFile('author') })
      expect(request.newContext).toHaveBeenNthCalledWith(2, { baseURL: origin })
      expect(recovery.post).toHaveBeenCalledTimes(1)
      expect(recovery.post).toHaveBeenCalledWith('/api/user/login/', { data: credentials })
      expect(recovery.get).toHaveBeenCalledWith('/api/user/me/')
      const state = JSON.parse(fs.readFileSync(batch.stateFile('author'), 'utf8'))
      expect(state.origins[0].localStorage).toContainEqual({ name: 'userId', value: '900' })
      expect(recovery.dispose).not.toHaveBeenCalled()
    } finally { await batch.close(); fs.rmSync(batch.directory, { recursive: true, force: true }) }
  })

  it.each(['login-rejected', 'wrong-identity'])('disposes failed owned recovery without saving a foreign session: %s', async mode => {
    const runId = `run-unit-foreign-${process.pid}-${Date.now()}`
    const reg = { version: 1, runId, marker: 'QAEDITOR-unit', origin, backendUrl: `${origin}/api`,
      accounts: { author: { id: 900, name: 'QAEDITOR-unit-author', activated: true, deleted: false } }, fixtures: [], ledger: [] }
    const expired = { get: jest.fn(async () => ({ ok: () => false, status: () => 401 })), dispose: jest.fn() }
    const wrongIdentity = { ok: () => true, status: () => 200, json: async () => ({ id: 1, name: 'protected', is_superuser: false }) }
    const login = mode === 'login-rejected' ? { ok: () => false, status: () => 401 } : wrongIdentity
    const recovery = { post: jest.fn(async () => login), get: jest.fn(async () => wrongIdentity),
      storageState: jest.fn(), dispose: jest.fn() }
    const request = require('@playwright/test').request
    request.newContext = jest.fn().mockResolvedValueOnce(expired).mockResolvedValueOnce(recovery)
    const batch = await openOwnedBatch({ baseUrl: origin, runId, initialRegistry: reg })
    writePrivate(path.join(batch.directory, 'author.credentials.private.json'), { email: 'owned-unit@example.test', password: 'unit-only' })
    try {
      await expect(batch.authorApi()).rejects.toThrow(mode === 'login-rejected' ? /Reauthenticate.*HTTP401/ : /Unexpected real account identity/)
      expect(expired.dispose).toHaveBeenCalledTimes(1)
      expect(recovery.dispose).toHaveBeenCalledTimes(1)
      expect(recovery.storageState).not.toHaveBeenCalled()
      expect(fs.existsSync(batch.stateFile('author'))).toBe(false)
    } finally { await batch.close(); fs.rmSync(batch.directory, { recursive: true, force: true }) }
  })
})
