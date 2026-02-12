import { Linking } from 'react-native';
import { normalizeExternalUrl, openExternalUrl } from '@/utils/externalLinks';

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
});
