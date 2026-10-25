/**
 * @jest-environment node
 */
import net from 'net'
import type { AddressInfo } from 'net'

import { LruCache, ResponseCache } from '@/scripts/ai-assist/cache'
import { loadConfig } from '@/scripts/ai-assist/config'
import { createLexicalSearch, parseCards } from '@/scripts/ai-assist/lexical'
import { BusyError, SingleFlight } from '@/scripts/ai-assist/queue'
import { createRedisClient, parseReply } from '@/scripts/ai-assist/redis'

describe('metravel-assist: LRU и кэш ответов', () => {
  it('LRU вытесняет самый давний ключ и считает попадания', () => {
    const cache = new LruCache<string>(2)
    cache.set('a', '1')
    cache.set('b', '2')
    expect(cache.get('a')).toBe('1')
    cache.set('c', '3')
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe('1')
    expect(cache.get('c')).toBe('3')
    expect(cache.size).toBe(2)
    expect([cache.hits, cache.misses]).toEqual([3, 1])
  })

  it('ResponseCache: redis — второй уровень, его ошибки не ломают ответ', async () => {
    const store = new Map<string, string>()
    const redis = {
      get: async (key: string) => store.get(key) ?? null,
      setEx: async (key: string, value: string) => void store.set(key, value),
      close: () => {},
    }
    const cache = new ResponseCache({ capacity: 5, ttlSeconds: 60, redis })
    await cache.set('k', 'v')
    expect(store.get('k')).toBe('v')
    expect(cache.stats()).toMatchObject({ size: 1, redis: true })
    const other = new ResponseCache({ capacity: 5, ttlSeconds: 60, redis })
    expect(await other.get('k')).toBe('v')
    expect(other.memory.size).toBe(1)

    const lines: string[] = []
    const broken = new ResponseCache({
      capacity: 5,
      ttlSeconds: 60,
      log: (line) => lines.push(line),
      redis: { ...redis, get: async () => Promise.reject(new Error('down')), setEx: async () => Promise.reject(new Error('down')) },
    })
    await broken.set('x', '1')
    expect(await broken.get('x')).toBe('1')
    expect(await broken.get('y')).toBeNull()
    expect(lines.some((line) => line.includes('down'))).toBe(true)
  })
})

describe('metravel-assist: очередь к модели', () => {
  it('выполняет по одному в порядке очереди, лишние получают BusyError', async () => {
    const queue = new SingleFlight()
    const order: string[] = []
    let release: () => void = () => {}
    const first = queue.run(1000, async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      order.push('first')
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(queue.isBusy).toBe(true)
    const second = queue.run(1000, async () => void order.push('second'))
    const third = queue.run(10, async () => void order.push('third'))
    await expect(third).rejects.toBeInstanceOf(BusyError)
    expect(queue.waiting).toBe(1)
    release()
    await Promise.all([first, second])
    expect(order).toEqual(['first', 'second'])
    expect(queue.isBusy).toBe(false)
  })
})

describe('metravel-assist: лексика бэкенда', () => {
  it('parseCards принимает results и голый список, строит URL из slug и отбрасывает битые пути', () => {
    const hits = parseCards(
      {
        results: [
          { id: 556, title: 'Камино', url: '/travels/kamino', slug: 'kamino', cityName: 'Краков', countryName: 'Польша', travel_image_thumb_url: 'https://metravel.by/travel-image/556/thumb.webp' },
          { id: 'x' },
          { id: 7, name: 'Без url', slug: 's7', travel_image_thumb_url: '/travel-image/7/thumb.webp' },
          { id: 8, title: 'Только url', url: '/travels/from-url' },
          { id: 9, title: 'Битый url (#1438)', url: '/travels/null' },
          { id: 10, title: 'slug битый, url цел', slug: 'undefined', url: '/travels/ok' },
        ],
      },
      'https://metravel.by/',
    )
    expect(hits).toEqual([
      { source_id: 556, title: 'Камино', url: 'https://metravel.by/travels/kamino', city: 'Краков', country: 'Польша', cover: 'https://metravel.by/travel-image/556/thumb.webp' },
      // #2459: относительная обложка не уходит в карточку подбора битой ссылкой.
      { source_id: 7, title: 'Без url', url: 'https://metravel.by/travels/s7', city: null, country: null, cover: null },
      { source_id: 8, title: 'Только url', url: 'https://metravel.by/travels/from-url', city: null, country: null, cover: null },
      { source_id: 10, title: 'slug битый, url цел', url: 'https://metravel.by/travels/ok', city: null, country: null, cover: null },
    ])
    expect(parseCards([{ id: 1, title: 't', url: 'https://x.test/a' }], 'https://metravel.by')[0].url).toBe('https://x.test/a')
    expect(parseCards({ detail: 'Not found.' }, 'https://metravel.by')).toEqual([])
  })

  it('ходит в /api/travels/?query= (кэшируемый список), а сбой или не-200 превращает в null', async () => {
    const urls: string[] = []
    const ok = createLexicalSearch({
      backendUrl: 'http://backend:8000/',
      timeoutMs: 100,
      fetchImpl: (async (url: string) => {
        urls.push(url)
        return new Response(JSON.stringify({ results: [{ id: 1, title: 'a', url: '/travels/a' }] }), { status: 200 })
      }) as unknown as typeof fetch,
    })
    expect(await ok('замки под Краковом', 20)).toEqual([{ source_id: 1, title: 'a', url: 'https://metravel.by/travels/a', city: null, country: null, cover: null }])
    expect(urls[0]).toBe('http://backend:8000/api/travels/?query=%D0%B7%D0%B0%D0%BC%D0%BA%D0%B8%20%D0%BF%D0%BE%D0%B4%20%D0%9A%D1%80%D0%B0%D0%BA%D0%BE%D0%B2%D0%BE%D0%BC&page_size=20')

    const lines: string[] = []
    const failing = createLexicalSearch({
      backendUrl: 'http://backend:8000',
      timeoutMs: 100,
      log: (line) => lines.push(line),
      fetchImpl: (async () => new Response('', { status: 502 })) as unknown as typeof fetch,
    })
    expect(await failing('q', 5)).toBeNull()
    const refused = createLexicalSearch({ backendUrl: 'http://127.0.0.1:1', timeoutMs: 500, log: (line) => lines.push(line) })
    expect(await refused('q', 5)).toBeNull()
    const slow = createLexicalSearch({
      backendUrl: 'http://backend:8000',
      timeoutMs: 10,
      log: (line) => lines.push(line),
      fetchImpl: ((_: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch,
    })
    expect(await slow('q', 5)).toBeNull()
    expect(lines).toHaveLength(3)
  })
})

describe('metravel-assist: redis-клиент', () => {
  it('parseReply разбирает простые строки, ошибки, числа и bulk, ждёт неполный ответ', () => {
    expect(parseReply(Buffer.from('+OK\r\n'))).toMatchObject({ value: 'OK' })
    expect(parseReply(Buffer.from(':5\r\n'))).toMatchObject({ value: 5 })
    expect(parseReply(Buffer.from('$-1\r\n'))).toMatchObject({ value: null })
    expect(parseReply(Buffer.from('$2\r\nhi\r\n+OK\r\n'))).toMatchObject({ value: 'hi' })
    expect(parseReply(Buffer.from('$5\r\nhi'))).toBeNull()
    expect((parseReply(Buffer.from('-ERR nope\r\n'))!.value as Error).message).toBe('ERR nope')
    expect(parseReply(Buffer.from('+OK'))).toBeNull()
  })

  /** Мини-сервер RESP: SELECT, SET, GET (ключ `slow` без ответа), счётчик соединений. */
  async function startMiniRedis() {
    const store = new Map<string, string>()
    const received: string[][] = []
    const sockets = new Set<net.Socket>()
    let connections = 0
    const server = net.createServer((socket) => {
      connections += 1
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
      // Разбор по байтам: длины bulk-строк в RESP байтовые, а значения в тесте — кириллица.
      let buffer: Buffer = Buffer.alloc(0)
      socket.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data])
        for (;;) {
          const head = buffer.indexOf('\r\n')
          if (head < 0 || buffer[0] !== 0x2a) return
          const count = Number(buffer.subarray(1, head).toString())
          let rest = buffer.subarray(head + 2)
          const parts: string[] = []
          for (let i = 0; i < count; i += 1) {
            const lineEnd = rest.indexOf('\r\n')
            if (lineEnd < 0) return
            const length = Number(rest.subarray(1, lineEnd).toString())
            if (rest.length < lineEnd + 2 + length + 2) return
            parts.push(rest.subarray(lineEnd + 2, lineEnd + 2 + length).toString('utf8'))
            rest = rest.subarray(lineEnd + 2 + length + 2)
          }
          buffer = rest
          received.push(parts)
          const [command, key, value] = parts
          if (command === 'SELECT') socket.write('+OK\r\n')
          else if (command === 'SET') {
            store.set(key, value)
            socket.write('+OK\r\n')
          } else if (command === 'GET' && key === 'slow') {
            /* ответа нет — клиент должен отвалиться по таймауту */
          } else if (command === 'GET') {
            const found = store.get(key)
            socket.write(found === undefined ? '$-1\r\n' : `$${Buffer.byteLength(found)}\r\n${found}\r\n`)
          } else socket.write('-ERR unknown\r\n')
        }
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    return {
      port,
      received,
      connections: () => connections,
      dropAll: () => sockets.forEach((socket) => socket.destroy()),
      close: () =>
        new Promise<void>((resolve) => {
          sockets.forEach((socket) => socket.destroy())
          server.close(() => resolve())
        }),
    }
  }

  it('GET/SET EX против мини-сервера RESP; таймаут — ошибка, а не зависание', async () => {
    const redis = await startMiniRedis()
    const client = createRedisClient({ url: `redis://127.0.0.1:${redis.port}/2`, timeoutMs: 100 })
    try {
      expect(await client.get('missing')).toBeNull()
      await client.setEx('k', 'значение', 3600)
      expect(await client.get('k')).toBe('значение')
      expect(redis.received[0]).toEqual(['SELECT', '2'])
      expect(redis.received.find((parts) => parts[0] === 'SET')).toEqual(['SET', 'k', 'значение', 'EX', '3600'])
      await expect(createRedisClient({ url: `redis://127.0.0.1:${redis.port}`, timeoutMs: 30 }).get('slow')).rejects.toThrow(/таймаут/)
    } finally {
      client.close()
      await redis.close()
    }
    const dead = createRedisClient({ url: 'redis://127.0.0.1:1', timeoutMs: 100 })
    await expect(dead.get('k')).rejects.toThrow()
    expect(() => createRedisClient({ url: 'http://x' })).toThrow(/redis:\/\//)
  })

  it('параллельные команды делят одно соединение; после обрыва SELECT повторяется на новом сокете', async () => {
    const redis = await startMiniRedis()
    const client = createRedisClient({ url: `redis://127.0.0.1:${redis.port}/3`, timeoutMs: 200 })
    try {
      await client.setEx('a', '1', 60)
      await client.setEx('b', '2', 60)
      redis.received.length = 0
      redis.dropAll()
      await new Promise((resolve) => setTimeout(resolve, 20))
      // Холодный клиент после обрыва: пять параллельных GET — одно новое соединение, ответы по своим ключам.
      expect(await Promise.all(['a', 'b', 'a', 'missing', 'b'].map((key) => client.get(key)))).toEqual(['1', '2', '1', null, '2'])
      expect(redis.connections()).toBe(2)
      expect(redis.received[0]).toEqual(['SELECT', '3'])
      expect(redis.received.filter((parts) => parts[0] === 'SELECT')).toHaveLength(1)
    } finally {
      client.close()
      await redis.close()
    }
  })

  it('недоступный хост: подключение ограничено таймаутом, а не таймаутом ОС', async () => {
    // 10.255.255.1 — немаршрутизируемый адрес: SYN уходит в пустоту, RST не приходит.
    const client = createRedisClient({ url: 'redis://10.255.255.1:6379', timeoutMs: 50 })
    const started = Date.now()
    await expect(client.get('k')).rejects.toThrow()
    expect(Date.now() - started).toBeLessThan(2000)
    client.close()
  })
})

describe('metravel-assist: конфиг', () => {
  it('читает переменные с дефолтами и отбрасывает мусорные числа', () => {
    const config = loadConfig({ PORT: '9000', AI_INDEX_DIR: '/index', BACKEND_URL: 'http://b:8000/', REDIS_URL: 'redis://r:6379', AI_ASSIST_OFFLINE: '1' })
    expect(config).toMatchObject({ port: 9000, indexDir: '/index', backendUrl: 'http://b:8000', redisUrl: 'redis://r:6379', offline: true, threads: 1, queueTimeoutMs: 2000, cacheSize: 500 })
    expect(loadConfig({}).redisUrl).toBeNull()
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/)
  })
})
