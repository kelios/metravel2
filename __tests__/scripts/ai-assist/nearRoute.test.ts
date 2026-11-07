/**
 * @jest-environment node
 */
import http from 'http'
import type { AddressInfo } from 'net'

import { createApp } from '@/scripts/ai-assist/app'
import { ResponseCache } from '@/scripts/ai-assist/cache'
import { AskLimits, createDayClock, MemoryCounterStore } from '@/scripts/ai-assist/limits'
import {
  distanceToRouteKm,
  NEAR_ROUTE_CORRIDOR_KM,
  NEAR_ROUTE_DEFAULT_LIMIT,
  NEAR_ROUTE_MAX_LIMIT,
  NEAR_ROUTE_MAX_POINTS,
  nearRouteItems,
} from '@/scripts/ai-assist/nearRoute'

import { fakeEmbedQuery, loadFixtureIndex, MODEL, type Spec, writeFixtureIndex } from './fixture'

// Маршрут Минск → Гродно; источники: у трассы, в Лиде (в коридоре, но не у точки),
// в Бресте (далеко), квест на двух локалях в Гродно и статья без координат.
const GEO: Spec[] = [
  { type: 'travel', sourceId: 10, title: 'Мир и Несвиж', text: 'замки мир несвиж', city: 'Мир', lat: 53.7, lng: 26.47 },
  { type: 'travel', sourceId: 11, title: 'Лида', text: 'лидский замок', city: 'Лида', lat: 53.89, lng: 25.3 },
  { type: 'travel', sourceId: 12, title: 'Брестская крепость', text: 'брест крепость', city: 'Брест', lat: 52.08, lng: 23.65 },
  { type: 'travel', sourceId: 13, title: 'Без координат', text: 'где-то', city: null, lat: null, lng: null },
  { type: 'quest', sourceId: 1, locale: 'ru', title: 'Квест по Гродно', text: 'квест гродно', city: 'Гродно', lat: 53.68, lng: 23.83 },
  { type: 'quest', sourceId: 1, locale: 'pl', title: 'Quest po Grodnie', text: 'квест гродно pl', city: 'Grodno', lat: 53.68, lng: 23.83 },
  { type: 'travel', sourceId: 14, title: 'Минск за день', text: 'минск центр', city: 'Минск', lat: 53.9, lng: 27.56 },
  { type: 'travel', sourceId: 14, title: 'Минск за день', text: 'минск вечер', city: 'Минск', lat: 53.9, lng: 27.56 },
]
const MINSK = { lat: 53.9, lng: 27.56 }
const GRODNO = { lat: 53.68, lng: 23.83 }

const geoIndex = () => loadFixtureIndex(writeFixtureIndex(MODEL, GEO))

describe('metravel-assist: геометрия /ai/near-route (#2911)', () => {
  it('расстояние до ломаной — до ближайшего сегмента, а не до вершин', () => {
    // Лида лежит ~30 км севернее середины трассы Минск–Гродно: до сегмента ближе, чем до любой вершины.
    const lida = { lat: 53.89, lng: 25.3 }
    const toSegment = distanceToRouteKm(lida, [MINSK, GRODNO])
    expect(toSegment).toBeLessThan(NEAR_ROUTE_CORRIDOR_KM)
    expect(toSegment).toBeLessThan(distanceToRouteKm(lida, [MINSK]))
    expect(toSegment).toBeLessThan(distanceToRouteKm(lida, [GRODNO]))
    // Одна точка маршрута — обычный haversine; точка на вершине — ноль.
    expect(distanceToRouteKm(GRODNO, [GRODNO])).toBe(0)
    expect(Math.round(distanceToRouteKm(MINSK, [GRODNO]))).toBe(246)
  })

  it('коридор 30 км, ближние первыми, дедуп по источнику, локаль квеста, без координат — мимо', () => {
    const items = nearRouteItems(geoIndex(), { points: [MINSK, GRODNO], locale: 'pl', limit: 10 })
    // Квест и статья 14 стоят на вершинах (0 км): при равном расстоянии порядок строк индекса.
    expect(items.map((item) => `${item.type}:${item.source_id}`)).toEqual(['quest:1', 'travel:14', 'travel:11', 'travel:10'])
    expect(items[0].distance_km).toBe(0)
    expect(items[0]).toMatchObject({ title: 'Quest po Grodnie', score: null, lat: 53.68, lng: 23.83, city: 'Grodno' })
    expect(items.map((item) => item.distance_km)).toEqual([...items.map((item) => item.distance_km)].sort((a, b) => a - b))
    expect(items.every((item) => item.distance_km <= NEAR_ROUTE_CORRIDOR_KM)).toBe(true)
    // Статья 12 (Брест) — 200+ км от трассы; статья 13 без координат.
    expect(items.find((item) => item.source_id === 12 || item.source_id === 13)).toBeUndefined()
    expect(nearRouteItems(geoIndex(), { points: [MINSK, GRODNO], locale: 'ru', limit: 2 })).toHaveLength(2)
  })
})

interface Reply {
  status: number
  body: any
}

function post(server: http.Server, body: unknown): Promise<Reply> {
  const { port } = server.address() as AddressInfo
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port, method: 'POST', path: '/ai/near-route', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve({ status: response.statusCode ?? 0, body: raw ? JSON.parse(raw) : null })
        })
      },
    )
    request.on('error', reject)
    request.write(payload)
    request.end()
  })
}

const listen = (server: http.Server) => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const close = (server: http.Server) => new Promise<void>((resolve) => server.close(() => resolve()))

function makeServer() {
  const embed = jest.fn(fakeEmbedQuery)
  const server = createApp({
    index: geoIndex(),
    modelKey: MODEL,
    embedQuery: embed,
    lexical: async () => [],
    cache: new ResponseCache({ capacity: 10, ttlSeconds: 60 }),
    queueTimeoutMs: 200,
    ask: {
      generator: null,
      limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock(), dailyLimit: 20, strikesToBlock: 3 }),
      demandLog: { path: '/dev/null', append: async () => {} },
      queueTimeoutMs: 200,
      trustProxy: true,
    },
    authorDraft: { limits: new AskLimits({ store: new MemoryCounterStore(), clock: createDayClock(), dailyLimit: 5, strikesToBlock: 3 }) },
    suggestTags: { catalog: { dictionary: async () => null, travelTags: async () => null } },
    log: () => {},
  })
  return { server, embed }
}

describe('metravel-assist: POST /ai/near-route', () => {
  it('формат items как у /ai/search плюс distance_km, took_ms, без обращения к модели', async () => {
    const { server, embed } = makeServer()
    await listen(server)
    try {
      const reply = await post(server, { points: [MINSK, GRODNO], limit: 3, locale: 'ru' })
      expect(reply.status).toBe(200)
      expect(reply.body.items).toHaveLength(3)
      expect(reply.body.items[0]).toEqual({
        type: 'quest',
        source_id: 1,
        title: 'Квест по Гродно',
        url: 'https://metravel.by/quests/1',
        snippet: 'квест гродно',
        score: null,
        city: 'Гродно',
        country: 'Польша',
        lat: 53.68,
        lng: 23.83,
        cover: null,
        distance_km: 0,
      })
      expect(typeof reply.body.took_ms).toBe('number')
      expect(embed).not.toHaveBeenCalled()
      // Лимит по умолчанию и строковые координаты из JSON-клиента.
      const defaults = await post(server, { points: [{ lat: '53.9', lng: '27.56' }] })
      expect(defaults.status).toBe(200)
      expect(defaults.body.items.length).toBeLessThanOrEqual(NEAR_ROUTE_DEFAULT_LIMIT)
      expect(defaults.body.items[0]).toMatchObject({ source_id: 14, distance_km: 0 })
    } finally {
      await close(server)
    }
  })

  it('400: нет точек, кривая точка, больше 50 точек, лимит вне 1..12; 405 на GET', async () => {
    const { server } = makeServer()
    await listen(server)
    try {
      expect((await post(server, {})).status).toBe(400)
      expect((await post(server, { points: [] })).status).toBe(400)
      expect((await post(server, { points: [{ lat: 91, lng: 0 }] })).body).toMatchObject({ error: 'bad_request', detail: expect.stringContaining('points[0]') })
      expect((await post(server, { points: [{ lat: 53, lng: 'x' }] })).status).toBe(400)
      expect((await post(server, { points: Array.from({ length: NEAR_ROUTE_MAX_POINTS + 1 }, () => MINSK) })).status).toBe(400)
      expect((await post(server, { points: [MINSK], limit: NEAR_ROUTE_MAX_LIMIT + 1 })).status).toBe(400)
      expect((await post(server, { points: [MINSK], limit: 0 })).status).toBe(400)
      expect((await post(server, { points: [MINSK], locale: 'de' })).status).toBe(400)
      const { port } = server.address() as AddressInfo
      const status = await new Promise<number>((resolve) => http.get({ host: '127.0.0.1', port, path: '/ai/near-route' }, (r) => resolve(r.statusCode ?? 0)))
      expect(status).toBe(405)
    } finally {
      await close(server)
    }
  })
})
