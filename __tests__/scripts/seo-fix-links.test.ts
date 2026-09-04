/**
 * Batch-exit regression for scripts/seo-fix-links.js (#1655).
 *
 * A caught detail GET used to print a warning and continue without incrementing
 * the final failure count, so an entirely unreadable batch exited 0.
 */
import http from 'http'

const { getJson, listTravels, main } = require('@/scripts/seo-fix-links')

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

/**
 * Пагинация автора (#1755).
 *
 * DRF отвечает на страницу за последней не пустым списком, а HTTP 404 «Invalid
 * page», поэтому конец перечисления обязан считаться ДО запроса следующей
 * страницы. Признака «страница недобрала строк» для этого не хватает: при
 * количестве статей, кратном размеру страницы, последняя страница полна.
 */
describe('seo-fix-links author pagination', () => {
  const page = (index: number, total: number, size = 100) => {
    const first = (index - 1) * size
    const rows = Array.from({ length: Math.max(0, Math.min(size, total - first)) }, (_, i) => ({
      id: first + i + 1,
    }))
    return rows
  }

  /** DRF: {count, next, results}; страница за последней — 404, как на проде. */
  const drfApi = (total: number, size = 100) => {
    const pages = Math.max(1, Math.ceil(total / size))
    return jest.fn(async (urlPath: string) => {
      const asked = Number(new URLSearchParams(urlPath.split('?')[1]).get('page'))
      if (asked > pages) throw new Error(`HTTP 404 /travels/?page=${asked}`)
      return {
        count: total,
        next: asked < pages ? `https://metravel.by/api/travels/?page=${asked + 1}` : null,
        results: page(asked, total, size),
      }
    })
  }

  it('stops on the last page when the count is an exact multiple of the page size', async () => {
    const getJsonStub = drfApi(300)

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(300)
    expect(getJsonStub).toHaveBeenCalledTimes(3)
  })

  it('reads every page when the last one is short', async () => {
    const getJsonStub = drfApi(320)

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(320)
    expect(getJsonStub).toHaveBeenCalledTimes(4)
  })

  it('asks for exactly the page size it checks against', async () => {
    const getJsonStub = drfApi(320)

    await listTravels(1, { getJson: getJsonStub })

    for (const [urlPath] of getJsonStub.mock.calls) {
      expect(new URLSearchParams(String(urlPath).split('?')[1]).get('perPage')).toBe('100')
    }
  })

  it('falls back to total for a legacy envelope without the next cursor', async () => {
    const getJsonStub = jest.fn(async (urlPath: string) => {
      const asked = Number(new URLSearchParams(urlPath.split('?')[1]).get('page'))
      if (asked > 2) throw new Error(`HTTP 404 /travels/?page=${asked}`)
      return { total: 200, data: page(asked, 200) }
    })

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(200)
    expect(getJsonStub).toHaveBeenCalledTimes(2)
  })

  it('does not mistake a null count for an exhausted list', async () => {
    const getJsonStub = jest.fn(async (urlPath: string) => {
      const asked = Number(new URLSearchParams(urlPath.split('?')[1]).get('page'))
      if (asked > 2) throw new Error(`HTTP 404 /travels/?page=${asked}`)
      return { total: null, count: null, data: page(asked, 150) }
    })

    await expect(listTravels(1, { getJson: getJsonStub })).resolves.toHaveLength(150)
  })
})
