import type { Page } from '@playwright/test'
import { installAnalyticsIntentRecorder, readAnalyticsIntents } from '../../e2e/helpers/analytics'
import { ANALYTICS_INTENT_EVENT } from '../../utils/analyticsIntent'

const collection = '__metravelAnalyticsIntents'
let listeners: Array<{ type: string; listener: EventListenerOrEventListenerObject }>
let addListener: jest.SpyInstance
beforeEach(() => {
  delete (window as unknown as Record<string, unknown>)[collection]
  listeners = []
  const original = window.addEventListener.bind(window)
  addListener = jest.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    listeners.push({ type, listener })
    original(type, listener, options)
  })
})
afterEach(() => {
  addListener.mockRestore()
  for (const { type, listener } of listeners) window.removeEventListener(type, listener)
  delete (window as unknown as Record<string, unknown>)[collection]
})

function fixture() {
  const scripts: Array<() => void> = []
  const page = {
    addInitScript: async (fn: (arg: unknown) => void, arg: unknown) => { scripts.push(() => fn(arg)) },
    evaluate: async (fn: (arg: unknown) => unknown, arg: unknown) => fn(arg),
  } as unknown as Page
  return { page, navigate: () => { for (const script of scripts) script() } }
}

it('installs before navigation, records exact intent payload/count and never replaces providers', async () => {
  const { page, navigate } = fixture()
  const provider = Object.getOwnPropertyDescriptor(window, 'gtag')
  const flag = navigator.webdriver
  await installAnalyticsIntentRecorder(page)
  await expect(readAnalyticsIntents(page, 'next_quest_click')).rejects.toThrow('not installed before navigation')
  navigate()
  const params = { quest_id: 'q1', source: 'collection' }
  window.dispatchEvent(new CustomEvent(ANALYTICS_INTENT_EVENT, { detail: { name: 'next_quest_click', params } }))
  params.source = 'changed later'
  window.dispatchEvent(new CustomEvent(ANALYTICS_INTENT_EVENT, { detail: { name: 'city_collection_view', params: { city_id: 'minsk' } } }))
  expect(await readAnalyticsIntents(page, 'next_quest_click')).toEqual([{ name: 'next_quest_click', params: { quest_id: 'q1', source: 'collection' } }])
  expect(await readAnalyticsIntents(page, 'city_collection_view')).toHaveLength(1)
  expect(addListener.mock.calls.map(([type]) => type)).toEqual([ANALYTICS_INTENT_EVENT])
  expect(Object.getOwnPropertyDescriptor(window, 'gtag')).toEqual(provider)
  expect(navigator.webdriver).toBe(flag)
})

it('repeated installation cannot double-count one request and rejects malformed intents', async () => {
  const { page, navigate } = fixture()
  await installAnalyticsIntentRecorder(page)
  await installAnalyticsIntentRecorder(page)
  navigate()
  for (const detail of [undefined, {}, { name: 'next_quest_click' }, { name: 3, params: {} }]) {
    window.dispatchEvent(new CustomEvent(ANALYTICS_INTENT_EVENT, { detail }))
  }
  window.dispatchEvent(new CustomEvent(ANALYTICS_INTENT_EVENT, { detail: { name: 'next_quest_click', params: {} } }))
  expect(await readAnalyticsIntents(page, 'next_quest_click')).toHaveLength(1)
  expect(addListener).toHaveBeenCalledTimes(1)
})
