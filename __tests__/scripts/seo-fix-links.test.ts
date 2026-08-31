/**
 * Batch-exit regression for scripts/seo-fix-links.js (#1655).
 *
 * A caught detail GET used to print a warning and continue without incrementing
 * the final failure count, so an entirely unreadable batch exited 0.
 */
import http from 'http'

const { getJson, main } = require('@/scripts/seo-fix-links')

describe('seo-fix-links batch exit contract', () => {
  it('rejects a JSON error response instead of treating it as a travel detail', async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ detail: 'upstream unavailable' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('test server did not bind to TCP')

    try {
      await expect(getJson('/travels/41/', `http://127.0.0.1:${address.port}/api`)).rejects.toThrow(
        'HTTP 503',
      )
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })

  it('counts caught detail GET failures and prints the summary before failing', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const getJson = jest.fn().mockRejectedValue(new Error('GET unavailable'))

    try {
      await expect(
        main(['node', 'script', '--dry-run'], {
          loadSlugMap: () => new Map([['old-slug', 'new-slug']]),
          listTravels: jest.fn().mockResolvedValue([
            { id: 41, name: 'Первая статья' },
            { id: 42, name: 'Вторая статья' },
          ]),
          getJson,
        }),
      ).rejects.toThrow('2 of 2 published travels failed')

      expect(getJson).toHaveBeenCalledTimes(2)
      expect(warnSpy).toHaveBeenCalledTimes(2)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 failed'))
    } finally {
      warnSpy.mockRestore()
      logSpy.mockRestore()
    }
  })
})
