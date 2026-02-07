import { safeJsonParse, safeJsonParseString } from '@/utils/safeJsonParse';

const makeResponse = (body: string, status = 200): Response => ({
  text: () => Promise.resolve(body),
  status,
  statusText: status === 200 ? 'OK' : 'Error',
} as unknown as Response);

describe('safeJsonParse (Response)', () => {

  it('parses valid JSON from Response', async () => {
    const res = makeResponse('{"a":1}');
    const result = await safeJsonParse(res);
    expect(result).toEqual({ a: 1 });
  });

  it('returns fallback for empty response body', async () => {
    const res = makeResponse('');
    const result = await safeJsonParse(res, []);
    expect(result).toEqual([]);
  });

  it('throws for empty body when no fallback', async () => {
    const res = makeResponse('  ');
    await expect(safeJsonParse(res)).rejects.toThrow('Пустой ответ от сервера');
  });

  it('returns fallback for invalid JSON', async () => {
    const res = makeResponse('not json', 200);
    const result = await safeJsonParse(res, { default: true });
    expect(result).toEqual({ default: true });
  });

  it('throws for invalid JSON when no fallback', async () => {
    const res = makeResponse('<html>error</html>', 500);
    await expect(safeJsonParse(res)).rejects.toThrow(/Не удалось прочитать ответ сервера/);
  });

  it('parses arrays', async () => {
    const res = makeResponse('[1,2,3]');
    expect(await safeJsonParse(res)).toEqual([1, 2, 3]);
  });
});

describe('safeJsonParseString', () => {
  it('parses valid JSON string', () => {
    expect(safeJsonParseString('{"x":42}')).toEqual({ x: 42 });
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParseString('', [])).toEqual([]);
  });

  it('returns fallback for whitespace-only string', () => {
    expect(safeJsonParseString('   ', 'default')).toBe('default');
  });

  it('throws for empty string when no fallback', () => {
    expect(() => safeJsonParseString('')).toThrow();
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParseString('{broken', null)).toBeNull();
  });

  it('throws for invalid JSON when no fallback', () => {
    expect(() => safeJsonParseString('{broken')).toThrow('Не удалось распарсить JSON строку');
  });

  it('parses nested objects', () => {
    const input = '{"a":{"b":[1,2]}}';
    expect(safeJsonParseString(input)).toEqual({ a: { b: [1, 2] } });
  });
});
