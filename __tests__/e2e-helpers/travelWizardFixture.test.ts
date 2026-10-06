import type { Page, Route } from '@playwright/test';
import { mockTravelWizardUpsert } from '../../e2e/helpers/travelWizardFixture';

type Matcher = string | ((url: URL) => boolean);
type Handler = (route: Route) => unknown;

function fixture() {
  const routes: Array<{ matcher: Matcher; handler: Handler }> = [];
  const page = {
    route: async (matcher: Matcher, handler: Handler) => { routes.push({ matcher, handler }); },
  } as unknown as Page;
  const matches = (matcher: Matcher, url: URL) => typeof matcher === 'function' ? matcher(url) :
    new RegExp('^' + matcher.split('**').map((part) => part.split('*').map((value) => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$').test(url.href);
  const request = async (pathname: string, method = 'GET', postData: string | null = null, omitRoutesOwner = false) => {
    const url = new URL(pathname, 'https://example.test');
    const candidates = routes.filter(({ matcher }) => matches(matcher, url) && !(omitRoutesOwner && typeof matcher === 'function')).reverse();
    const fulfill = jest.fn();
    const continueRequest = jest.fn();
    const run = async (index: number): Promise<unknown> => {
      if (!candidates[index]) return continueRequest();
      return candidates[index].handler({
        request: () => ({ method: () => method, postData: () => postData }), fulfill,
        fallback: () => run(index + 1), continue: continueRequest,
      } as unknown as Route);
    };
    await run(0);
    return { fulfill, continueRequest, response: fulfill.mock.calls[0]?.[0] };
  };
  return { page, request };
}

it('pairs generated upsert IDs with empty route files while preserving the original payload and ID sequence', async () => {
  const { page, request } = fixture();
  await mockTravelWizardUpsert(page);
  expect((await request('/api/travels/10000/routes/')).continueRequest).toHaveBeenCalledTimes(1);
  const first = await request('/api/travels/upsert/', 'POST', JSON.stringify({ data: { name: 'Wizard draft', publish: false } }));
  expect(JSON.parse(first.response.body)).toEqual({ id: 10000, name: 'Wizard draft', publish: false });
  const second = await request('/travels/upsert/', 'PUT', JSON.stringify({ description: 'Next draft' }));
  expect(JSON.parse(second.response.body)).toEqual({ id: 10001, name: 'E2E Travel', description: 'Next draft' });
  for (const path of ['/api/travels/10000/routes/?page=1', '/travels/10001/routes/']) {
    const result = await request(path);
    expect(result.response).toEqual({ status: 200, contentType: 'application/json', body: '[]' });
    expect(result.continueRequest).not.toHaveBeenCalled();
  }
  expect((await request('/api/travels/10002/routes/')).continueRequest).toHaveBeenCalledTimes(1);
});

it('honors an explicit ID returned by the upsert fixture without claiming unreturned neighbors', async () => {
  const { page, request } = fixture();
  await mockTravelWizardUpsert(page);
  const result = await request('/api/travels/upsert/', 'PUT', JSON.stringify({ data: { id: 151800, name: 'Saved fixture' } }));
  expect(JSON.parse(result.response.body)).toEqual({ id: 151800, name: 'Saved fixture' });
  expect((await request('/api/travels/151800/routes/')).response.body).toBe('[]');
  expect((await request('/api/travels/151801/routes/')).continueRequest).toHaveBeenCalledTimes(1);
});

it('falls through for non-GET, neighboring paths, route detail and download endpoints', async () => {
  const { page, request } = fixture();
  await mockTravelWizardUpsert(page);
  await request('/api/travels/upsert/', 'POST', '{}');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const result = await request('/api/travels/10000/routes/', method);
    expect(result.fulfill).not.toHaveBeenCalled();
    expect(result.continueRequest).toHaveBeenCalledTimes(1);
  }
  for (const path of ['/api/travels/10000/routes/7/', '/api/travels/10000/routes/7/download/', '/api/travels/10000/', '/api/trips/planned/10000/routes/']) {
    const result = await request(path);
    expect(result.fulfill).not.toHaveBeenCalled();
    expect(result.continueRequest).toHaveBeenCalledTimes(1);
  }
  expect((await request('/api/travels/upsert/', 'GET')).continueRequest).toHaveBeenCalledTimes(1);
});

it('negative control removes only the route-list owner; restoring it prevents the unmocked fake-ID read', async () => {
  const { page, request } = fixture();
  await mockTravelWizardUpsert(page);
  await request('/api/travels/upsert/', 'POST', '{}');
  const missing = await request('/api/travels/10000/routes/', 'GET', null, true);
  expect(missing.fulfill).not.toHaveBeenCalled();
  expect(missing.continueRequest).toHaveBeenCalledTimes(1);
  const restored = await request('/api/travels/10000/routes/');
  expect(restored.response).toEqual({ status: 200, contentType: 'application/json', body: '[]' });
  expect(restored.continueRequest).not.toHaveBeenCalled();
});
