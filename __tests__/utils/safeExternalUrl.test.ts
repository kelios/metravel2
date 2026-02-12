import { getSafeExternalUrl } from '@/utils/safeExternalUrl';

describe('getSafeExternalUrl', () => {
  it('passes through valid https URLs', () => {
    expect(getSafeExternalUrl('https://example.com')).toBe('https://example.com/');
  });

  it('adds https scheme when missing', () => {
    expect(getSafeExternalUrl('example.com/path')).toBe('https://example.com/path');
  });

  it('rejects unsafe schemes', () => {
    expect(getSafeExternalUrl('javascript:alert(1)')).toBe('');
    expect(getSafeExternalUrl('data:text/html,hello')).toBe('');
  });

  it('resolves relative URLs against a base', () => {
    expect(getSafeExternalUrl('/map', { baseUrl: 'https://metravel.by' })).toBe('https://metravel.by/map');
  });

  it('rejects relative URLs when relative links are disabled', () => {
    expect(getSafeExternalUrl('/map', { allowRelative: false })).toBe('');
    expect(getSafeExternalUrl('./map', { allowRelative: false })).toBe('');
  });

  it('blocks protocol-relative URLs unless allowed', () => {
    expect(getSafeExternalUrl('//evil.example')).toBe('');
    expect(getSafeExternalUrl('//metravel.by', { allowProtocolRelative: true })).toBe('https://metravel.by');
  });

  it('allows custom protocols when explicitly configured', () => {
    const tg = 'tg://msg_url?url=https%3A%2F%2Fmetravel.by';
    expect(getSafeExternalUrl(tg, { allowedProtocols: ['http:', 'https:', 'tg:'], allowRelative: false })).toBe(tg);
  });
});
