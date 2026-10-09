/** @jest-environment node */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Browser, type Route } from 'playwright'
import { physicalMeasurer } from '@/workers/book-renderer/measurement'

jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }))

describe('physical measurement resource readiness with a mocked browser port', () => {
  it.each(['corrupted', 'oversized'])('rejects a %s font request that fails during readiness after setContent completed', async kind => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    const scratch = await mkdtemp(path.join(root, 'book-font-readiness-'))
    const fonts = path.join(scratch, 'fonts')
    await mkdir(fonts)
    const filename = `${'a'.repeat(64)}.woff2`
    await writeFile(path.join(fonts, 'fonts.css'), '@font-face { font-family: Fixture; }')
    await writeFile(path.join(fonts, filename), kind === 'corrupted' ? 'corrupted frozen font bytes' : Buffer.alloc(2 * 1024 * 1024 + 1))
    let handleRoute!: (route: Route) => Promise<void>
    const abort = jest.fn().mockResolvedValue(undefined)
    const route = { request: () => ({ url: () => `https://book-snapshot.invalid/fonts/${filename}` }), abort } as unknown as Route
    const page = {
      setDefaultTimeout: jest.fn(), emulateMedia: jest.fn(), setContent: jest.fn(),
      evaluate: jest.fn().mockResolvedValue(false).mockImplementationOnce(async () => { await handleRoute(route) }),
      pdf: jest.fn().mockResolvedValue(Buffer.from('/Count 1')), goto: jest.fn(), requestGC: jest.fn(),
    }
    const close = jest.fn().mockResolvedValue(undefined)
    const browser = { close, newContext: async () => ({
      route: async (_pattern: string, handler: typeof handleRoute) => { handleRoute = handler },
      newPage: async () => page,
    }) }
    jest.mocked(chromium.launch).mockResolvedValueOnce(browser as unknown as Browser)
    let measurer: Awaited<ReturnType<typeof physicalMeasurer>> | undefined
    try {
      measurer = await physicalMeasurer(scratch, scratch, fonts)
      await expect(measurer.measure('<html><head></head><body></body></html>'))
        .rejects.toThrow('WORKER_FONT_INTEGRITY_FAILED')
      expect(abort).toHaveBeenCalledTimes(1)
      expect(page.pdf).not.toHaveBeenCalled()
    } finally {
      await measurer?.close()
      await rm(scratch, { recursive: true, force: true })
    }
    expect(close).toHaveBeenCalledTimes(1)
  })
})
