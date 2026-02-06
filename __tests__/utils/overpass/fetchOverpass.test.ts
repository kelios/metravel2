import { fetchOsmPoi, fetchOsmRoutes, normalizeBBox } from '@/utils/overpass';

describe('fetchOverpass', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ elements: [] }),
    }));
  });

  it('fetchOsmPoi posts encoded Overpass QL', async () => {
    const bbox = normalizeBBox({ south: 10, west: 20, north: 11, east: 21 });
    await fetchOsmPoi(bbox);

    const fetchMock = (global as any).fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalled();

    const [_url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toContain('application/x-www-form-urlencoded');
    expect(String(init.body)).toContain('data=');
    expect(decodeURIComponent(String(init.body))).toContain('out center tags;');
  });

  it('fetchOsmRoutes posts encoded Overpass QL and requests geom', async () => {
    const bbox = normalizeBBox({ south: -1, west: -2, north: 1, east: 2 });
    await fetchOsmRoutes(bbox);

    const fetchMock = (global as any).fetch as jest.Mock;
    const [_url, init] = fetchMock.mock.calls[0];
    expect(String(init.body)).toContain('data=');
    expect(decodeURIComponent(String(init.body))).toContain('out geom tags;');
  });

  it('throws on non-ok response', async () => {
    // All attempts fail with a transient error -> should still throw after exhausting endpoints.
    (global as any).fetch = jest.fn(async () => ({
      ok: false,
      status: 504,
      text: async () => 'server is probably too busy',
    }));

    const bbox = normalizeBBox({ south: 10, west: 20, north: 11, east: 21 });
    await expect(fetchOsmPoi(bbox)).rejects.toThrow('Overpass error 504');
  });
});
