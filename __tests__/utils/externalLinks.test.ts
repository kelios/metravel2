import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  normalizeExternalUrl,
  normalizeHttpOrInternalUrl,
  openExternalUrl,
  openExternalUrlInNewTab,
  openWebWindow,
} from '@/utils/externalLinks';

describe('externalLinks', () => {
  it('normalizes valid URLs and adds https when scheme is missing', () => {
    expect(normalizeExternalUrl('https://metravel.by')).toBe('https://metravel.by/');
    expect(normalizeExternalUrl('metravel.by/about')).toBe('https://metravel.by/about');
  });

  it('rejects unsafe or malformed URLs', () => {
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('');
    expect(normalizeExternalUrl('data:text/html;base64,Zm9v')).toBe('');
    expect(normalizeExternalUrl('vbscript:msgbox(1)')).toBe('');
    expect(normalizeExternalUrl('//evil.example')).toBe('');
    expect(normalizeExternalUrl('/relative/path')).toBe('');
    expect(normalizeExternalUrl('')).toBe('');
  });

  it('normalizes editor links while accepting only http(s) or internal relative addresses', () => {
    expect(normalizeHttpOrInternalUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    );
    expect(normalizeHttpOrInternalUrl('example.com/path')).toBe(
      'https://example.com/path',
    );
    expect(normalizeHttpOrInternalUrl('/trips/plan/1601?edit=1')).toBe(
      'https://metravel.by/trips/plan/1601?edit=1',
    );
    expect(normalizeHttpOrInternalUrl('../trips/my')).toBe(
      'https://metravel.by/trips/my',
    );
  });

  it('rejects unsafe, protocol-relative and non-http editor links', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html;base64,Zm9v',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com/file',
      'example',
      'https://localhost/path',
      '//evil.example/path',
      '/\\evil.example/path',
      '?edit=1',
      '#route',
      'https://example.com/line\nbreak',
      '',
    ]) {
      expect(normalizeHttpOrInternalUrl(value)).toBe('');
    }
  });

  it('opens only safe normalized URLs', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce();

    await expect(openExternalUrl('example.com')).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://example.com/');

    openSpy.mockClear();
    await expect(openExternalUrl('javascript:alert(1)')).resolves.toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('returns false and forwards error to onError callback when opening fails', async () => {
    const openError = new Error('cannot-open');
    const openSpy = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(openError);
    const onError = jest.fn();

    await expect(openExternalUrl('https://example.com', { onError })).resolves.toBe(false);
    expect(openSpy).toHaveBeenCalledWith('https://example.com/');
    expect(onError).toHaveBeenCalledWith(openError);
  });

  it('opens a safe url in new web tab with noopener by default', async () => {
    const originalPlatform = Platform.OS;
    const originalOpen = window.open;
    try {
      (Platform.OS as any) = 'web';
      const windowOpen = jest.fn().mockReturnValue({ opener: {} });
      (window as any).open = windowOpen;

      await expect(openExternalUrlInNewTab('metravel.by')).resolves.toBe(true);
      expect(windowOpen).toHaveBeenCalledWith('https://metravel.by/', '_blank', 'noopener');
    } finally {
      (window as any).open = originalOpen;
      (Platform.OS as any) = originalPlatform;
    }
  });

  it('allows callers to opt into noreferrer explicitly', async () => {
    const originalPlatform = Platform.OS;
    const originalOpen = window.open;
    try {
      (Platform.OS as any) = 'web';
      const windowOpen = jest.fn().mockReturnValue({ opener: {} });
      (window as any).open = windowOpen;

      await expect(
        openExternalUrlInNewTab('metravel.by', { windowFeatures: 'noopener,noreferrer' }),
      ).resolves.toBe(true);
      expect(windowOpen).toHaveBeenCalledWith('https://metravel.by/', '_blank', 'noopener,noreferrer');
    } finally {
      (window as any).open = originalOpen;
      (Platform.OS as any) = originalPlatform;
    }
  });

  it('does not open unsafe urls in new web tab', async () => {
    const originalPlatform = Platform.OS;
    const originalOpen = window.open;
    try {
      (Platform.OS as any) = 'web';
      const windowOpen = jest.fn();
      (window as any).open = windowOpen;

      await expect(openExternalUrlInNewTab('javascript:alert(1)')).resolves.toBe(false);
      expect(windowOpen).not.toHaveBeenCalled();
    } finally {
      (window as any).open = originalOpen;
      (Platform.OS as any) = originalPlatform;
    }
  });

  it('#580 native: falls back from om:// to geo: when Organic Maps is not installed', async () => {
    const originalPlatform = Platform.OS;
    try {
      (Platform.OS as any) = 'android';
      const openSpy = jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValueOnce(new Error('ActivityNotFoundException'))
        .mockResolvedValueOnce();

      await expect(
        openExternalUrl('om://map?v=1&ll=53.9006,27.559', {
          allowedProtocols: ['om:', 'geo:'],
        }),
      ).resolves.toBe(true);

      expect(openSpy).toHaveBeenNthCalledWith(1, 'om://map?v=1&ll=53.9006,27.559');
      expect(openSpy).toHaveBeenNthCalledWith(2, 'geo:53.9006,27.559?q=53.9006,27.559');
      openSpy.mockRestore();
    } finally {
      (Platform.OS as any) = originalPlatform;
    }
  });

  it('opens generic web window and nulls opener', () => {
    const originalOpen = window.open;
    const winRef: any = { opener: {} };
    const windowOpen = jest.fn().mockReturnValue(winRef);
    (window as any).open = windowOpen;

    const result = openWebWindow('about:blank', { target: '_blank', windowFeatures: 'noopener' });
    expect(result).toBe(winRef);
    expect(windowOpen).toHaveBeenCalledWith('about:blank', '_blank', 'noopener');
    expect(winRef.opener).toBeNull();

    (window as any).open = originalOpen;
  });

  it('returns null when web window open fails', () => {
    const originalOpen = window.open;
    const windowOpen = jest.fn().mockImplementation(() => {
      throw new Error('blocked');
    });
    const onError = jest.fn();
    (window as any).open = windowOpen;

    const result = openWebWindow('about:blank', { onError });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalled();

    (window as any).open = originalOpen;
  });

  // #2135: на native ссылка на наш сайт с экраном приложения открывается в
  // приложении — системный браузер показал бы сайт с cookie-баннером (5.1.2(i)).
  describe('own-site links on native', () => {
    const originalPlatform = Platform.OS;
    const push = router.push as jest.Mock;

    beforeEach(() => {
      push.mockClear();
    });

    afterEach(() => {
      (Platform.OS as any) = originalPlatform;
      jest.restoreAllMocks();
    });

    it.each(['ios', 'android'])('%s: opens a metravel.by article as an app screen, not in the browser', async (os) => {
      (Platform.OS as any) = os;
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue();

      await expect(
        openExternalUrl('https://metravel.by/travels/akkaunty-v-instagram?returnTo=%2Fsearch#points'),
      ).resolves.toBe(true);
      await expect(openExternalUrlInNewTab('https://www.metravel.by/travels/forty-krakova')).resolves.toBe(true);
      await expect(
        openExternalUrl('/places', { allowRelative: true, baseUrl: 'https://metravel.by' }),
      ).resolves.toBe(true);

      expect(push.mock.calls).toEqual([
        ['/travels/akkaunty-v-instagram?returnTo=%2Fsearch'],
        ['/travels/forty-krakova'],
        ['/places'],
      ]);
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('keeps site paths without an app screen and foreign hosts in the browser', async () => {
      (Platform.OS as any) = 'ios';
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue();

      for (const url of [
        'https://metravel.by/board',
        'https://metravel.by/api/user/export/archive.zip',
        'https://metravel.by/media/exports/book.pdf',
        'https://metravel.by/travels',
        'https://evil-metravel.by/travels/x',
        'https://www.instagram.com/metravelby/',
      ]) {
        await expect(openExternalUrl(url)).resolves.toBe(true);
      }

      expect(push).not.toHaveBeenCalled();
      expect(openSpy.mock.calls.map(([url]) => url)).toEqual([
        'https://metravel.by/board',
        'https://metravel.by/api/user/export/archive.zip',
        'https://metravel.by/media/exports/book.pdf',
        'https://metravel.by/travels',
        'https://evil-metravel.by/travels/x',
        'https://www.instagram.com/metravelby/',
      ]);
    });

    it('web keeps opening own-site links as browser links', async () => {
      (Platform.OS as any) = 'web';
      const originalOpen = window.open;
      const windowOpen = jest.fn().mockReturnValue({ opener: {} });
      (window as any).open = windowOpen;
      try {
        await expect(openExternalUrlInNewTab('https://metravel.by/travels/forty-krakova')).resolves.toBe(true);
        expect(windowOpen).toHaveBeenCalledWith('https://metravel.by/travels/forty-krakova', '_blank', 'noopener');
        expect(push).not.toHaveBeenCalled();
      } finally {
        (window as any).open = originalOpen;
      }
    });
  });
});
