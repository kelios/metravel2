import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { apiClient, __setBackendRefreshEndpointForTests } from '@/api/client'
import { __resetSessionTokenWritesForTests } from '@/utils/authTokenStore'
import { fetchStatusWithTimeout, fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { getSecureItem, readSecureItem, setSecureItem, removeSecureItems } from '@/utils/secureStorage'
import {
  APP_CRASH_QUEUE_KEY,
  __resetAppTelemetry,
  enqueueAppCrashReport,
  flushAppCrashReports,
  getAppTelemetryEnvironment,
  setAppTelemetryEnabled,
} from '@/utils/appTelemetry'

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
  fetchStatusWithTimeout: jest.fn(),
}))
jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: jest.fn(),
  readSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
  removeSecureItems: jest.fn(),
}))
jest.mock('expo-device', () => ({ modelName: 'iPhone 15' }))

const fetchMock = jest.mocked(fetchWithTimeout)
const getToken = jest.mocked(getSecureItem)
const originalOS = Platform.OS
const acknowledgement = { accepted: 1, duplicates: 0 }
const response = (status: number, body: unknown = acknowledgement): Response => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
}) as Response

beforeEach(async () => {
  __resetAppTelemetry()
  __resetSessionTokenWritesForTests()
  await AsyncStorage.clear()
  jest.clearAllMocks()
  fetchMock.mockReset()
  getToken.mockReset().mockResolvedValue(null)
  jest.mocked(setSecureItem).mockReset().mockResolvedValue(undefined)
  jest.mocked(removeSecureItems).mockReset().mockResolvedValue(undefined)
  jest.mocked(readSecureItem).mockImplementation(async (key) => ({ value: await getToken(key), unavailable: false }))
  jest.mocked(fetchStatusWithTimeout).mockResolvedValue({ ok: true, status: 200 })
  Platform.OS = 'ios'
})

afterEach(() => {
  __resetAppTelemetry()
  __setBackendRefreshEndpointForTests(false)
  __resetSessionTokenWritesForTests()
  Platform.OS = originalOS
})

it.each([200, 204])('rejects HTTP %s when the caller requires 202', async (status) => {
  fetchMock.mockResolvedValue(response(status))
  await expect(apiClient.post('/expected-status', {}, undefined, { expectedStatus: 202 }))
    .rejects.toMatchObject({ status })
  expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('expectedStatus')
})

it('preserves ordinary successful responses when no status is required', async () => {
  fetchMock.mockResolvedValue(response(200))
  await expect(apiClient.post('/ordinary-status', {})).resolves.toEqual(acknowledgement)
  fetchMock.mockResolvedValue(response(204))
  await expect(apiClient.post('/ordinary-status', {})).resolves.toBeNull()
})

it('checks the status of the anonymous read fallback', async () => {
  getToken.mockResolvedValue('live-token')
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200))
  await expect(apiClient.request('/fallback-status', { method: 'GET', expectedStatus: 202 }))
    .rejects.toMatchObject({ status: 200 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it.each([200, 202])('checks HTTP %s after token refresh as well', async (status) => {
  __setBackendRefreshEndpointForTests(true)
  const disk = new Map([['userToken', 'old-token'], ['refreshToken', 'refresh-token']])
  getToken.mockImplementation(async (key) => disk.get(key) ?? null)
  jest.mocked(setSecureItem).mockImplementation(async (key, value) => { disk.set(key, value) })
  jest.mocked(removeSecureItems).mockImplementation(async (keys) => { keys.forEach((key) => disk.delete(key)) })
  // Старый токен после успешной ротации уже отозван. Проба им уничтожила бы
  // новую, корректно сохранённую пару токенов.
  jest.mocked(fetchStatusWithTimeout).mockResolvedValue({ ok: false, status: 401 })
  fetchMock
    .mockResolvedValueOnce(response(401))
    .mockResolvedValueOnce(response(200, { access: 'new-token', refresh: 'new-refresh' }))
    .mockResolvedValueOnce(response(status))
  const request = apiClient.post('/refresh-status', {}, undefined, { expectedStatus: 202 })
  if (status === 202) await expect(request).resolves.toEqual(acknowledgement)
  else await expect(request).rejects.toMatchObject({ status: 200 })
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(fetchStatusWithTimeout).not.toHaveBeenCalled()
  expect(removeSecureItems).not.toHaveBeenCalled()
  expect(disk.get('userToken')).toBe('new-token')
  expect(disk.get('refreshToken')).toBe('new-refresh')
})

it('keeps a crash after HTTP 200 with a valid ack and removes it only after HTTP 202', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  await enqueueAppCrashReport({
    ...getAppTelemetryEnvironment(),
    id,
    install_id: '22222222-2222-4222-8222-222222222222',
    session_id: '33333333-3333-4333-8333-333333333333',
    ts: '2026-10-28T10:00:00.000Z',
    kind: 'js_exception',
    fatal: true,
    message: 'TypeError',
    stack: 'at index.bundle:1:42',
  })
  fetchMock.mockResolvedValue(response(200))
  await flushAppCrashReports()
  expect(JSON.parse((await AsyncStorage.getItem(APP_CRASH_QUEUE_KEY))!)).toHaveLength(1)

  __resetAppTelemetry()
  fetchMock.mockClear().mockResolvedValue(response(202))
  await flushAppCrashReports()
  expect(JSON.parse((await AsyncStorage.getItem(APP_CRASH_QUEUE_KEY))!)).toEqual([])
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ id })
})

it('does not send telemetry when the switch turns off during the token read', async () => {
  jest.mocked(readSecureItem).mockImplementation(async () => {
    await setAppTelemetryEnabled(false)
    return { value: null, unavailable: false }
  })
  fetchMock.mockResolvedValue(response(202))
  await enqueueAppCrashReport({
    ...getAppTelemetryEnvironment(),
    id: '11111111-1111-4111-8111-111111111111',
    install_id: '22222222-2222-4222-8222-222222222222',
    session_id: '33333333-3333-4333-8333-333333333333',
    ts: '2026-10-28T10:00:00.000Z',
    kind: 'js_exception',
    fatal: false,
    message: 'TypeError',
    stack: '',
  })
  await flushAppCrashReports()
  expect(fetchMock).not.toHaveBeenCalled()
})
