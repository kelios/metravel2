/**
 * Клиентский предохранитель частоты (#1516, задача 8).
 *
 * Сохранение статьи адресуется двумя контрактами, и один из них — адресный
 * (`/travels/{id}/content/`). Без сегментного шаблона такой эндпоинт вообще не
 * имеет персонального потолка: каждый id даёт новый ключ и берёт дефолт.
 */
import { RateLimiter } from '@/utils/rateLimiter'

describe('RateLimiter', () => {
  it('применяет персональный потолок к точному ключу', () => {
    const limiter = new RateLimiter({ maxPerEndpoint: 5, endpointLimits: { '/travels/upsert/': 2 } })

    expect(limiter.acquire('/travels/upsert/')).not.toBeNull()
    expect(limiter.acquire('/travels/upsert/')).not.toBeNull()
    expect(limiter.acquire('/travels/upsert/')).toBeNull()
  })

  it('применяет потолок шаблона с сегментом * к адресному эндпоинту', () => {
    const limiter = new RateLimiter({
      maxPerEndpoint: 50,
      endpointLimits: { '/travels/*/content/': 2 },
    })

    expect(limiter.acquire('/travels/619/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/')).toBeNull()
  })

  it('считает разные статьи независимо', () => {
    const limiter = new RateLimiter({ endpointLimits: { '/travels/*/content/': 1 } })

    expect(limiter.acquire('/travels/619/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/')).toBeNull()
    expect(limiter.acquire('/travels/620/content/')).not.toBeNull()
  })

  it('шаблон матчит ровно один сегмент и не задевает соседние пути', () => {
    const limiter = new RateLimiter({
      maxPerEndpoint: 3,
      endpointLimits: { '/travels/*/content/': 1 },
    })

    expect(limiter.acquire('/travels/619/1/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/1/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/extra/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/extra/')).not.toBeNull()
  })

  it('точный ключ имеет приоритет над шаблоном', () => {
    const limiter = new RateLimiter({
      maxPerEndpoint: 10,
      endpointLimits: { '/travels/*/content/': 1, '/travels/619/content/': 3 },
    })

    expect(limiter.acquire('/travels/619/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/')).toBeNull()
  })

  it('игнорирует query при выборе потолка', () => {
    const limiter = new RateLimiter({ maxPerEndpoint: 9, endpointLimits: { '/travels/*/content/': 1 } })

    expect(limiter.acquire('/travels/619/content/?x=1')).not.toBeNull()
    expect(limiter.acquire('/travels/619/content/?y=2')).toBeNull()
  })
})
