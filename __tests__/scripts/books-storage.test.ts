/** @jest-environment node */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const storage = require('../../scripts/books/storage.cjs');
const {checkContent} = require('../../scripts/books/copy-publication.cjs');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const pdf = Buffer.from('%PDF-1.7 fixture');
const webp = Buffer.from('RIFF0000WEBPfixture');
const asset = (relative: string, bytes: Buffer) => ({uri: 'https://metravel.by/travel-books/' + relative, relative, bytes: bytes.length, sha256: digest(bytes)});
const credentials = {accessKeyId: 'AKIDFIXTURE', secretAccessKey: 'fixture-secret'};

type Call = {url: string; method: string; headers: Record<string, string>};
/** An in-memory bucket answering like public S3: 403 for an absent key, checksums on request. */
function bucket(objects: Record<string, {bytes: number; sha256: string}> = {}) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (url: string, init: {method: string; headers: Record<string, string>; body?: Buffer}) => {
    calls.push({url, method: init.method, headers: init.headers});
    const {pathname, searchParams} = new URL(url);
    const key = pathname.slice(1);
    if (init.method === 'PUT') {
      if (objects[key]) return new Response(null, {status: 412});
      objects[key] = {bytes: init.body!.length, sha256: digest(init.body!)};
      return new Response(null, {status: 200});
    }
    if (init.method === 'DELETE') { delete objects[key]; return new Response(null, {status: 204}); }
    if (init.method === 'GET' && searchParams.get('list-type') === '2') {
      const keys = Object.keys(objects).sort();
      const page = searchParams.get('continuation-token') ? keys.slice(1) : keys.slice(0, 1);
      const more = !searchParams.get('continuation-token') && keys.length > 1;
      return new Response(`<ListBucketResult>${page.map(k => `<Contents><Key>${k}</Key><Size>${objects[k].bytes}</Size></Contents>`).join('')}<IsTruncated>${more}</IsTruncated>${more ? '<NextContinuationToken>next</NextContinuationToken>' : ''}</ListBucketResult>`, {status: 200});
    }
    const object = objects[key];
    if (!object) return new Response(null, {status: 403});
    const headers = new Headers({'content-length': String(object.bytes)});
    if (init.headers['x-amz-checksum-mode'] === 'ENABLED') headers.set('x-amz-checksum-sha256', Buffer.from(object.sha256, 'hex').toString('base64'));
    return new Response(null, {status: 200, headers});
  });
  return {objects, calls, fetchImpl};
}

describe('ready-book storage (#2971)', () => {
  // The GET Object example of the AWS Signature Version 4 documentation.
  it('signs requests exactly as the published SigV4 example', () => {
    const headers = storage.signRequest({
      method: 'GET', key: 'test.txt', region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z'),
      headers: {host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9'}, payloadHash: storage.EMPTY_SHA256,
      credentials: {accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'},
    });
    expect(headers.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  });

  // The GET Bucket (List Objects) example of the same documentation: the query is part of the signature.
  it('signs a listing with its canonical query', () => {
    const headers = storage.signRequest({
      method: 'GET', key: '', query: {'max-keys': '2', prefix: 'J'}, region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z'),
      headers: {host: 'examplebucket.s3.amazonaws.com'}, payloadHash: storage.EMPTY_SHA256,
      credentials: {accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'},
    });
    expect(headers.authorization).toContain('Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
  });

  it('keys an object by its public URL path and types it by extension', () => {
    expect(storage.objectUrl(asset('book/r1/album-a5/read-body.pdf', pdf))).toBe('https://metravelprod.s3.eu-north-1.amazonaws.com/travel-books/book/r1/album-a5/read-body.pdf');
    expect(storage.contentType('book/r1/fonts/OFL.txt')).toBe('text/plain; charset=utf-8');
    for (const relative of ['book/../x.pdf', 'book//x.pdf', 'book/r1/x y.pdf', '']) expect(() => storage.objectKey({relative})).toThrow('Invalid publication storage key');
    expect(() => storage.contentType('book/r1/run.js')).toThrow('No storage content type');
  });

  it('tells present, missing and different objects apart and fails on other answers', async () => {
    const stored = asset('book/r1/read-body.pdf', pdf);
    const {fetchImpl} = bucket({'travel-books/book/r1/read-body.pdf': {bytes: stored.bytes, sha256: stored.sha256}, 'travel-books/book/r1/other.pdf': {bytes: stored.bytes, sha256: 'f'.repeat(64)}});
    expect(await storage.headObject(stored, {fetchImpl})).toBe('present');
    expect(await storage.headObject(asset('book/r1/absent.pdf', pdf), {fetchImpl})).toBe('missing');
    expect(await storage.headObject({...stored, relative: 'book/r1/other.pdf'}, {fetchImpl})).toBe('conflict');
    await expect(storage.headObject(stored, {fetchImpl: jest.fn(async () => new Response(null, {status: 500}))})).rejects.toThrow('HTTP 500');
  });

  it('uploads only what storage lacks, never overwrites and confirms each object', async () => {
    const first = asset('book/r1/read-body.pdf', pdf), second = asset('book/r1/preview-body-1.webp', webp);
    const store = bucket({'travel-books/book/r1/read-body.pdf': {bytes: first.bytes, sha256: first.sha256}});
    const readBytes = jest.fn(async (a: {relative: string}) => (a.relative.endsWith('.webp') ? webp : pdf));
    expect(await storage.uploadAssets([first, second], {readBytes, credentials, checkContent, fetchImpl: store.fetchImpl})).toEqual({files: 2, uploaded: 1, present: 1, bytes: webp.length});
    expect(readBytes).toHaveBeenCalledTimes(1);
    const put = store.calls.find(call => call.method === 'PUT')!;
    expect(put.url).toBe('https://metravelprod.s3.eu-north-1.amazonaws.com/travel-books/book/r1/preview-body-1.webp');
    expect(put.headers).toMatchObject({'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', 'if-none-match': '*',
      'x-amz-checksum-sha256': Buffer.from(second.sha256, 'hex').toString('base64'), 'x-amz-content-sha256': second.sha256});
    expect(put.headers.host).toBeUndefined();
    expect(put.headers.authorization).toMatch(/SignedHeaders=cache-control;content-type;host;if-none-match;x-amz-checksum-sha256;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  });

  it('refuses a changed object, a wrong source and a wrong content role before sending', async () => {
    const stored = asset('book/r1/read-body.pdf', pdf);
    const changed = bucket({'travel-books/book/r1/read-body.pdf': {bytes: stored.bytes, sha256: 'f'.repeat(64)}});
    await expect(storage.uploadAssets([stored], {readBytes: async () => pdf, credentials, checkContent, fetchImpl: changed.fetchImpl})).rejects.toThrow('Immutable publication asset changed in storage');
    const empty = bucket();
    await expect(storage.uploadAssets([stored], {readBytes: async () => Buffer.from('other'), credentials, checkContent, fetchImpl: empty.fetchImpl})).rejects.toThrow('source checksum mismatch');
    await expect(storage.uploadAssets([asset('book/r1/preview-body-1.webp', pdf)], {readBytes: async () => pdf, credentials, checkContent, fetchImpl: empty.fetchImpl})).rejects.toThrow('Invalid WebP');
    expect(empty.calls.some(call => call.method === 'PUT')).toBe(false);
    await expect(storage.uploadAssets([stored], {readBytes: async () => pdf, credentials: {}, fetchImpl: empty.fetchImpl})).rejects.toThrow('credentials are required');
  });

  it('lists every page under travel-books/ and deletes only there', async () => {
    const store = bucket({'travel-books/a/r/x.pdf': {bytes: 3, sha256: 'a'.repeat(64)}, 'travel-books/b/r/y.pdf': {bytes: 5, sha256: 'b'.repeat(64)}});
    expect(await storage.listObjects(credentials, {fetchImpl: store.fetchImpl})).toEqual([{key: 'travel-books/a/r/x.pdf', bytes: 3}, {key: 'travel-books/b/r/y.pdf', bytes: 5}]);
    expect(store.calls[0].url).toBe('https://metravelprod.s3.eu-north-1.amazonaws.com/?list-type=2&prefix=travel-books%2F');
    await storage.deleteObject('travel-books/a/r/x.pdf', credentials, {fetchImpl: store.fetchImpl});
    expect(Object.keys(store.objects)).toEqual(['travel-books/b/r/y.pdf']);
    await expect(storage.deleteObject('photo.webp', credentials, {fetchImpl: store.fetchImpl})).rejects.toThrow('outside travel-books/');
  });

  it('plans to remove only objects no kept manifest references', () => {
    const kept = [asset('book/r1/read-body.pdf', pdf), asset('book/r2/read-body.pdf', pdf)];
    const plan = storage.planPrune([
      {key: 'travel-books/book/r1/read-body.pdf', bytes: 16}, {key: 'travel-books/book/r2/read-body.pdf', bytes: 16},
      {key: 'travel-books/book/aborted/read-body.pdf', bytes: 100},
    ], kept);
    expect(plan).toMatchObject({objects: 3, referenced: 2, bytes: 100});
    expect(plan.orphans.map((object: {key: string}) => object.key)).toEqual(['travel-books/book/aborted/read-body.pdf']);
    expect(() => storage.planPrune([{key: 'photo.webp', bytes: 1}], kept)).toThrow('Unexpected storage key');
    expect(() => storage.planPrune([{key: 'travel-books/a', bytes: 1}], [])).toThrow('Refusing to prune');
  });

  describe('with a scratch directory', () => {
    let root: string;
    beforeEach(async () => {
      await fs.mkdir('.codex-temp', {recursive: true});
      root = await fs.mkdtemp(path.resolve('.codex-temp/books-storage-test-'));
    });
    afterEach(async () => { await fs.rm(root, {recursive: true, force: true}); });

    it('confirms files once, remembers them and names what is missing', async () => {
      const first = asset('book/r1/read-body.pdf', pdf), second = asset('book/r1/preview-body-1.webp', webp);
      const {fetchImpl} = bucket({'travel-books/book/r1/read-body.pdf': {bytes: first.bytes, sha256: first.sha256}});
      const cacheFile = path.join(root, 'verified.json');
      await expect(storage.verifyAssets([first, second], {cacheFile, fetchImpl})).rejects.toThrow('Book storage lacks 1 of 2 files');
      await expect(storage.verifyAssets([first, second], {cacheFile, fetchImpl})).rejects.toThrow('missing: book/r1/preview-body-1.webp');
      fetchImpl.mockClear();
      expect(await storage.verifyAssets([first], {cacheFile, fetchImpl})).toEqual({files: 1, checked: 0});
      expect(fetchImpl).not.toHaveBeenCalled();
      await expect(storage.verifyAssets([{...first, sha256: 'e'.repeat(64)}], {cacheFile, fetchImpl})).rejects.toThrow('conflict: book/r1/read-body.pdf');
    });

    it('reads the media key from a file outside the repository', async () => {
      const backend = path.join(root, 'local_env.sh');
      await fs.writeFile(backend, "export AWS_ACCESS_KEY_ID='AKIDMEDIA'\nexport AWS_SECRET_ACCESS_KEY='media-secret'\n# comment\n");
      expect(await storage.loadCredentials({METRAVEL_BOOKS_S3_ENV: backend})).toEqual({accessKeyId: 'AKIDMEDIA', secretAccessKey: 'media-secret'});
      expect(await storage.loadCredentials({METRAVEL_BOOKS_S3_ACCESS_KEY_ID: 'AKIDENV', METRAVEL_BOOKS_S3_SECRET_ACCESS_KEY: 'env-secret'})).toEqual({accessKeyId: 'AKIDENV', secretAccessKey: 'env-secret'});
    });

    it('reads publication sources without following symlinks', async () => {
      await fs.mkdir(path.join(root, 'publication/book/r1'), {recursive: true});
      await fs.writeFile(path.join(root, 'publication/book/r1/read-body.pdf'), pdf);
      expect(await storage.readPublicationFile(path.join(root, 'publication'), asset('book/r1/read-body.pdf', pdf))).toEqual(pdf);
      await fs.symlink(path.join(root, 'publication/book/r1'), path.join(root, 'publication/book/r2'));
      await expect(storage.readPublicationFile(path.join(root, 'publication'), asset('book/r2/read-body.pdf', pdf))).rejects.toThrow('symlink');
    });
  });
});
