import path from 'node:path'
import { expect, test } from '@playwright/test'

const { openOwnedBatch, writePrivate, targetConfig } = require('./prod-probe/travelEditorFixtures')
const { openRoleContext, runEditorHistory } = require('./helpers/editorFixtureBrowser')

// Uses the same assertion-bearing scenario as the explicit production probe.
// Local real backend only; no production document/auth/activation substitute.
test.describe('Owned editor single browser Back (live-contract #2702)', () => {
  test.describe.configure({ mode: 'serial', retries: 0 })
  let batch: Awaited<ReturnType<typeof openOwnedBatch>>

  test.beforeAll(async ({ baseURL }) => {
    test.setTimeout(240_000)
    expect(baseURL, 'explicit local web origin').toBeTruthy()
    const backendUrl = process.env.E2E_API_URL
    expect(backendUrl, 'explicit verified local backend origin').toBeTruthy()
    expect(targetConfig(baseURL, backendUrl).production, 'this spec never uses production fixtures/SSH').toBe(false)
    expect(process.env.E2E_ALLOW_LIVE_MUTATIONS, 'local owned fixture writes are explicit').toBe('1')
    batch = await openOwnedBatch({ baseUrl: baseURL, backendUrl,
      runId: `run-local-${Date.now()}-${process.pid}`, needOther: false })
    // afterAll owns teardown even when this setup assertion fails partway.
    await batch.setup()
  })

  test.afterAll(async () => {
    test.setTimeout(240_000)
    if (batch) {
      try { await batch.cleanup(); expect(batch.reg.cleaned).toBe(true) }
      finally { await batch.close() }
    }
  })

  for (const width of [1440, 390]) for (const temperature of ['cold', 'warm']) for (const editorState of ['step1', 'step6']) {
    test(`${width} ${temperature} ${editorState}: actual Edit → one browser Back → same list; Forward restores editor`, async ({ browser }, info) => {
      test.setTimeout(90_000)
      expect(batch?.reg.setupComplete, 'real owned fixture setup completed').toBe(true)
      const { context, page } = await openRoleContext(browser, batch, 'author', width)
      const entries: unknown[] = []
      try {
        await runEditorHistory({ context, page, batch, width, temperature, editorState, depth: 'nonzero',
          emit: async (entry: unknown) => { entries.push(entry) },
          write: (filename: string, source: string) => writePrivate(path.join(batch.directory, 'scripts', filename), source) })
      } finally {
        await info.attach('editor-history-business-and-causal-evidence', { body: Buffer.from(JSON.stringify(entries, null, 2)), contentType: 'application/json' })
        await context.close()
      }
    })
  }
})
