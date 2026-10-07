import { loginApi } from '@/api/auth';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));
const transport = jest.mocked(fetchWithTimeout);
const response = (status: number, body: unknown): Response => ({
  status, ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(body), json: async () => body,
} as Response);
const session = { id: 7, name: 'Fixture', token: 'fake-access', refresh: 'fake-refresh' };

beforeEach(() => { jest.useFakeTimers(); transport.mockReset(); });
afterEach(() => { jest.useRealTimers(); });

it.each([502, 503])('login HTTP %i retains exactly one retry, then returns its session', async (status) => {
  transport.mockResolvedValueOnce(response(status, { detail: 'Przekroczono limit czasu' }))
    .mockResolvedValueOnce(response(200, session));
  const attempt = loginApi(' fixture@example.test ', 'password');
  await jest.advanceTimersByTimeAsync(499);
  expect(transport).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await expect(attempt).resolves.toMatchObject({ ok: true, user: { id: 7 } });
  expect(transport).toHaveBeenCalledTimes(2);
  expect(transport).toHaveBeenLastCalledWith(expect.stringContaining('/user/login/'), expect.objectContaining({
    method: 'POST', body: JSON.stringify({ email: 'fixture@example.test', password: 'password' }),
  }), expect.any(Number));
});

it.each([400, 401, 403, 408, 429, 500, 504])('login HTTP %i settles after one call despite misleading body text', async (status) => {
  transport.mockResolvedValue(response(status, { detail: 'Network request failed; retry503' }));
  const attempt = loginApi('fixture@example.test', 'password');
  await jest.runAllTimersAsync();
  await expect(attempt).resolves.toMatchObject({ ok: false });
  expect(transport).toHaveBeenCalledTimes(1);
});

it('an unstructured status-bearing Error cannot cause a retry', async () => {
  transport.mockRejectedValue(new Error('Login failed: 503'));
  const attempt = loginApi('fixture@example.test', 'password');
  await jest.runAllTimersAsync();
  await expect(attempt).resolves.toMatchObject({ ok: false });
  expect(transport).toHaveBeenCalledTimes(1);
});
