import type { BrowserContext, Route } from '@playwright/test';
import { installReadOnlyTravelApi } from '../../e2e/helpers/readOnlyTravelApi';

const baseURL = 'http://127.0.0.1:8085';
const viewPath = '/api/travels/544/view/';
type Handler = (route: Route) => Promise<void>;

async function fixture(options = { baseURL: baseURL as string | undefined, travelId: 544 }) {
  const register = jest.fn(async (_pattern: string, _handler: Handler) => undefined);
  const ledger = await installReadOnlyTravelApi({ route: register } as unknown as BrowserContext, options);
  expect(register).toHaveBeenCalledTimes(1);
  expect(register.mock.calls[0][0]).toBe('**/api/**');
  const handle = register.mock.calls[0][1];
  return { ...ledger, handle };
}

function requestRoute(method: string, url: string) {
  const continueRequest = jest.fn(async () => undefined);
  const fulfill = jest.fn(async (_response: unknown) => undefined);
  const abort = jest.fn(async (_reason: string) => undefined);
  const route = { request: () => ({ method: () => method, url: () => url }), continue: continueRequest, fulfill, abort };
  return { route: route as unknown as Route, continueRequest, fulfill, abort };
}

it.each([
  [baseURL, 544, '/api/travels/544/view/'],
  [baseURL, 791, '/api/travels/791/view/'],
  ['https://metravel.by', 791, '/api/travels/791/view/'],
] as const)('simulates only the expected article view on %s for ID %s', async (origin, travelId, expectedPath) => {
  const guard = await fixture({ baseURL: origin, travelId });
  const request = requestRoute('POST', origin + expectedPath);
  await guard.handle(request.route);

  expect(request.fulfill).toHaveBeenCalledWith({ status: 204 });
  expect(request.continueRequest).not.toHaveBeenCalled();
  expect(request.abort).not.toHaveBeenCalled();
  expect(guard.handledViews).toEqual([{ method: 'POST', path: expectedPath }]);
  expect(guard.unexpectedWrites).toEqual([]);
});

it.each([
  ['another article', 'POST', `${baseURL}/api/travels/545/view/`],
  ['another origin', 'POST', 'https://other.example/api/travels/544/view/'],
  ['another port', 'POST', 'http://127.0.0.1:8086/api/travels/544/view/'],
  ['another scheme', 'POST', 'https://127.0.0.1:8085/api/travels/544/view/'],
  ['embedded credentials', 'POST', 'http://user:password@127.0.0.1:8085/api/travels/544/view/'],
  ['query', 'POST', `${baseURL}${viewPath}?extra=1`],
  ['empty query', 'POST', `${baseURL}${viewPath}?`],
  ['hash', 'POST', `${baseURL}${viewPath}#extra`],
  ['empty hash', 'POST', `${baseURL}${viewPath}#`],
  ['missing slash', 'POST', `${baseURL}/api/travels/544/view`],
  ['extra path', 'POST', `${baseURL}${viewPath}extra/`],
  ['encoded ID', 'POST', `${baseURL}/api/travels/%35%34%34/view/`],
  ['path alias', 'POST', `${baseURL}/api/travels/544/../544/view/`],
  ['another mutation', 'POST', `${baseURL}/api/travels/upsert/`],
  ['wrong method', 'DELETE', baseURL + viewPath],
])('blocks and records %s instead of authorizing a backend write', async (_label, method, url) => {
  const guard = await fixture();
  const request = requestRoute(method, url);
  await guard.handle(request.route);

  expect(request.abort).toHaveBeenCalledWith('blockedbyclient');
  expect(request.fulfill).not.toHaveBeenCalled();
  expect(request.continueRequest).not.toHaveBeenCalled();
  expect(guard.handledViews).toEqual([]);
  expect(guard.unexpectedWrites).toEqual([{ method, path: new URL(url).pathname }]);
});

it.each([
  ['GET', `${baseURL}/api/travels/by-slug/real-article/?include=all`],
  ['HEAD', `${baseURL}/api/travels/by-slug/real-article/`],
  ['OPTIONS', `${baseURL}/api/travels/by-slug/real-article/`],
  ['GET', baseURL + viewPath],
])('keeps real %s %s outside the view fixture', async (method, url) => {
  const guard = await fixture();
  const request = requestRoute(method, url);
  await guard.handle(request.route);

  expect(request.continueRequest).toHaveBeenCalledTimes(1);
  expect(request.fulfill).not.toHaveBeenCalled();
  expect(request.abort).not.toHaveBeenCalled();
  expect(guard.handledViews).toEqual([]);
  expect(guard.unexpectedWrites).toEqual([]);
});

it('keeps missing and duplicate view observations distinguishable for the exactly-one traversal gate', async () => {
  const guard = await fixture();
  expect(guard.handledViews).toHaveLength(0);
  await guard.handle(requestRoute('POST', baseURL + viewPath).route);
  await guard.handle(requestRoute('POST', baseURL + viewPath).route);
  expect(guard.handledViews).toHaveLength(2);
  expect(guard.unexpectedWrites).toEqual([]);
});

it.each([undefined, '/relative', 'ftp://example.test', 'https://user:password@example.test', 'https://example.test/?query=1', 'https://example.test/#hash'])('rejects an absent or untrusted web base URL before routing (variant %#)', async origin => {
  const register = jest.fn();
  await expect(installReadOnlyTravelApi({ route: register } as unknown as BrowserContext, { baseURL: origin, travelId: 544 })).rejects.toThrow(/explicit trusted HTTP\(S\) base URL/);
  expect(register).not.toHaveBeenCalled();
});

it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid expected article identity before routing (variant %#)', async travelId => {
  const register = jest.fn();
  await expect(installReadOnlyTravelApi({ route: register } as unknown as BrowserContext, { baseURL, travelId })).rejects.toThrow(/positive expected travel ID/);
  expect(register).not.toHaveBeenCalled();
});
