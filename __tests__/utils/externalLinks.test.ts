import { Linking, Platform } from 'react-native';
import { normalizeExternalUrl, openExternalUrl, openExternalUrlInNewTab, openWebWindow } from '@/utils/externalLinks';

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

  it('opens only safe normalized URLs', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce();

    await expect(openExternalUrl('metravel.by')).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://metravel.by/');

    openSpy.mockClear();
    await expect(openExternalUrl('javascript:alert(1)')).resolves.toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('returns false and forwards error to onError callback when opening fails', async () => {
    const openError = new Error('cannot-open');
    const openSpy = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(openError);
    const onError = jest.fn();

    await expect(openExternalUrl('https://metravel.by', { onError })).resolves.toBe(false);
    expect(openSpy).toHaveBeenCalledWith('https://metravel.by/');
    expect(onError).toHaveBeenCalledWith(openError);
  });

  it('opens a safe url in new web tab with noopener,noreferrer', async () => {
    const originalPlatform = Platform.OS;
    const originalOpen = window.open;
    try {
      (Platform.OS as any) = 'web';
      const windowOpen = jest.fn().mockReturnValue({ opener: {} });
      (window as any).open = windowOpen;

      await expect(openExternalUrlInNewTab('metravel.by')).resolves.toBe(true);
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
});
