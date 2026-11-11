/**
 * #3227: единый контракт состояний адреса квеста. 404/410 адресного чтения —
 * «не найдено», всё остальное — «ошибка»; порядок сигналов у всех форм адреса один.
 */
import {
  classifyQuestLoadFailure,
  resolveQuestAddressState,
  resolveQuestCatalogAddressState,
} from '@/utils/questAddressState'

const apiError = (status: number, message = 'error: Quest with quest_id=x not found') =>
  Object.assign(new Error(message), { name: 'ApiError', status })

describe('classifyQuestLoadFailure', () => {
  it.each([404, 410])('%s бэкенда — «не найдено»', (status) => {
    expect(classifyQuestLoadFailure(apiError(status))).toBe('not_found')
  })

  it.each([0, 400, 401, 403, 408, 429, 500, 502, 503, 504, 599])('статус %s — «ошибка»', (status) => {
    expect(classifyQuestLoadFailure(apiError(status))).toBe('error')
  })

  it('ошибка без статуса (обрыв сети, таймаут, отмена) — «ошибка», не «не найдено»', () => {
    expect(classifyQuestLoadFailure(new TypeError('Network request failed'))).toBe('error')
    expect(classifyQuestLoadFailure(new Error('timeout'))).toBe('error')
    expect(classifyQuestLoadFailure('boom')).toBe('error')
    expect(classifyQuestLoadFailure({ status: '404' })).toBe('error')
  })

  it('нет ошибки — нет сбоя', () => {
    expect(classifyQuestLoadFailure(null)).toBeNull()
    expect(classifyQuestLoadFailure(undefined)).toBeNull()
  })
})

describe('resolveQuestAddressState', () => {
  const base = { resolved: false, loading: false, failure: null } as const

  it('данные сильнее любого другого сигнала', () => {
    expect(resolveQuestAddressState({ resolved: true, loading: true, failure: 'error', loaderNotFound: true })).toBe('ready')
  })

  it('маркер loader-а отвечает «не найдено», не дожидаясь источника', () => {
    expect(resolveQuestAddressState({ ...base, loading: true, loaderNotFound: true })).toBe('not_found')
  })

  it('пока источник не ответил — загрузка, даже если прошлый ответ был сбоем', () => {
    expect(resolveQuestAddressState({ ...base, loading: true, failure: 'error' })).toBe('loading')
  })

  it('сбой источника передаётся как есть', () => {
    expect(resolveQuestAddressState({ ...base, failure: 'error' })).toBe('error')
    expect(resolveQuestAddressState({ ...base, failure: 'not_found' })).toBe('not_found')
  })

  it('источник ответил и адреса не знает — «не найдено»', () => {
    expect(resolveQuestAddressState(base)).toBe('not_found')
  })
})

describe('resolveQuestCatalogAddressState', () => {
  it('упавший каталог без данных — «ошибка», а не «не найдено» (#2914)', () => {
    expect(resolveQuestCatalogAddressState(false, false, true, false)).toBe('error')
  })

  it('каталог ответил и адреса не знает — «не найдено»; разрешённый адрес маркер loader-а не перекрывает', () => {
    expect(resolveQuestCatalogAddressState(false, false, false, false)).toBe('not_found')
    expect(resolveQuestCatalogAddressState(false, true, false, true)).toBe('not_found')
    expect(resolveQuestCatalogAddressState(true, false, false, true)).toBe('ready')
    expect(resolveQuestCatalogAddressState(false, true, false, false)).toBe('loading')
  })
})
