import { readFileSync } from 'fs';
import { join } from 'path';

const mockFileSystemState: {
  cacheDirectory: string | null;
  paths?: { cache?: { uri?: string } };
} = {
  cacheDirectory: 'file:///cache/',
};

jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() {
    return mockFileSystemState.cacheDirectory;
  },
  get Paths() {
    return mockFileSystemState.paths;
  },
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const FileSystem = require('expo-file-system/legacy');
const Sharing = require('expo-sharing');
const web = require('@/utils/fileTransfer.web.ts');
const native = require('@/utils/fileTransfer.native.ts');

describe('fileTransfer web', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({ text: async () => 'gpx' });
    global.fetch = fetchMock;
  });

  it('reads blob, data and http(s) through fetch', async () => {
    await expect(web.readUriAsText('blob:preview')).resolves.toBe('gpx');
    await expect(web.readUriAsText('data:text/plain,hi')).resolves.toBe('gpx');
    await expect(web.readUriAsText('https://metravel.by/route.gpx')).resolves.toBe('gpx');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects file, content and other schemes instead of calling the native SDK', async () => {
    await expect(web.readUriAsText('file:///tmp/route.gpx')).rejects.toThrow('');
    await expect(web.readUriAsText('content://media/route')).rejects.toThrow('');
    await expect(web.readUriAsText('ftp://example.com/route.gpx')).rejects.toThrow('');
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('keeps an empty uri empty and does not pretend a cache write succeeded', async () => {
    await expect(web.readUriAsText('')).resolves.toBe('');
    await expect(web.writeAsStringAsync('file:///cache/a.gpx', '<gpx/>')).rejects.toThrow('');
    await expect(web.shareAsync('file:///cache/a.gpx', { mimeType: 'application/gpx+xml' })).rejects.toThrow('');
    await expect(web.downloadAsync('https://metravel.by/a.png', 'file:///cache/a.png')).rejects.toThrow('');
    expect(await web.isShareAvailable()).toBe(false);
    expect(await web.shareRemoteImageOnNative('https://metravel.by/a.png', 'a.png', 'Share')).toBe(false);
    expect(web.resolveCacheDirectory(true)).toBe('');
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('does not mention the native SDK in the web module', () => {
    const source = readFileSync(join(__dirname, '../../utils/fileTransfer.web.ts'), 'utf8');
    expect(source).not.toMatch(/expo-file-system|expo-sharing/);
  });
});

describe('fileTransfer native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystemState.cacheDirectory = 'file:///cache/';
    mockFileSystemState.paths = undefined;
    FileSystem.deleteAsync.mockResolvedValue(undefined);
    FileSystem.downloadAsync.mockResolvedValue({ uri: 'file:///cache/downloaded.png' });
    FileSystem.readAsStringAsync.mockResolvedValue('text');
    FileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockResolvedValue(undefined);
  });

  it('uses cacheDirectory and falls back to Paths.cache.uri only when asked', () => {
    expect(native.resolveCacheDirectory(true)).toBe('file:///cache/');
    expect(native.resolveCacheDirectory(false)).toBe('file:///cache/');

    mockFileSystemState.cacheDirectory = null;
    mockFileSystemState.paths = { cache: { uri: 'file:///paths-cache/' } };
    expect(native.resolveCacheDirectory(true)).toBe('file:///paths-cache/');
    expect(native.resolveCacheDirectory(false)).toBe('');
  });

  it('writes utf8 and base64, and propagates share cancellation', async () => {
    await native.writeAsStringAsync('file:///cache/route.gpx', '<gpx/>');
    await native.writeAsStringAsync('file:///cache/route.gpx', 'YQ==', { encoding: 'base64' });
    expect(FileSystem.writeAsStringAsync).toHaveBeenNthCalledWith(1, 'file:///cache/route.gpx', '<gpx/>');
    expect(FileSystem.writeAsStringAsync).toHaveBeenNthCalledWith(2, 'file:///cache/route.gpx', 'YQ==', {
      encoding: 'base64',
    });

    Sharing.shareAsync.mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    await expect(native.shareAsync('file:///cache/route.gpx', {
      mimeType: 'application/gpx+xml',
      dialogTitle: 'Сохранить',
      UTI: 'com.topografix.gpx',
    })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reads native file and content URIs as utf8 and rejects malformed reads', async () => {
    await expect(native.readUriAsText('file:///cache/note.txt')).resolves.toBe('text');
    await expect(native.readUriAsText('content://media/note')).resolves.toBe('text');
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('content://media/note', { encoding: 'utf8' });
    await expect(native.readUriAsText('')).resolves.toBe('');

    FileSystem.readAsStringAsync.mockRejectedValue(new Error('malformed'));
    await expect(native.readUriAsText('file:///bad')).rejects.toThrow('malformed');
  });

  it('shares a remote image only after a safe URL, cache directory and share sheet exist', async () => {
    await expect(native.shareRemoteImageOnNative('javascript:alert(1)', 'a.png', 'Share')).resolves.toBe(false);
    expect(FileSystem.downloadAsync).not.toHaveBeenCalled();

    mockFileSystemState.cacheDirectory = null;
    await expect(native.shareRemoteImageOnNative('https://metravel.by/a.png', 'a.png', 'Share')).resolves.toBe(false);
    expect(FileSystem.downloadAsync).not.toHaveBeenCalled();

    mockFileSystemState.cacheDirectory = 'file:///cache/';
    Sharing.isAvailableAsync.mockResolvedValue(false);
    await expect(native.shareRemoteImageOnNative('https://metravel.by/a.png', 'a.png', 'Share')).resolves.toBe(false);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();

    Sharing.isAvailableAsync.mockResolvedValue(true);
    await expect(native.shareRemoteImageOnNative('https://metravel.by/a.png', 'story.png', 'Instagram')).resolves.toBe(true);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/story.png', { idempotent: true });
    expect(FileSystem.downloadAsync).toHaveBeenCalledWith('https://metravel.by/a.png', 'file:///cache/story.png');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/downloaded.png', {
      mimeType: 'image/png',
      dialogTitle: 'Instagram',
    });
  });
});
