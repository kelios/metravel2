import {
  isPotentiallyDangerous,
  sanitizeInput,
  isSafeUrl,
  isValidTokenFormat,
  isTokenExpired,
} from '@/utils/security';

describe('security utils', () => {
  describe('isPotentiallyDangerous', () => {
    it('returns false for empty or non-string input', () => {
      expect(isPotentiallyDangerous('')).toBe(false);
      // @ts-expect-error intentional invalid type
      expect(isPotentiallyDangerous(undefined)).toBe(false);
      // @ts-expect-error intentional invalid type
      expect(isPotentiallyDangerous(null)).toBe(false);
    });

    it('detects common XSS patterns', () => {
      expect(isPotentiallyDangerous('<script>alert(1)</script>')).toBe(true);
      expect(isPotentiallyDangerous('javascript:alert(1)')).toBe(true);
      expect(isPotentiallyDangerous('<img src="x" onerror="alert(1)" />')).toBe(true);
      expect(isPotentiallyDangerous('<iframe src="https://evil.com"></iframe>')).toBe(true);
      expect(isPotentiallyDangerous('<object data="x"></object>')).toBe(true);
      expect(isPotentiallyDangerous('<embed src="x" />')).toBe(true);
      expect(isPotentiallyDangerous('data:text/html;base64,AAAA')).toBe(true);
      expect(isPotentiallyDangerous('vbscript:msgbox(1)')).toBe(true);
    });

    it('returns false for safe text', () => {
      expect(isPotentiallyDangerous('Hello, world!')).toBe(false);
      expect(isPotentiallyDangerous('https://example.com/page?param=value')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('returns empty string for empty or non-string input', () => {
      expect(sanitizeInput('')).toBe('');
      // @ts-expect-error intentional invalid type
      expect(sanitizeInput(undefined)).toBe('');
      // @ts-expect-error intentional invalid type
      expect(sanitizeInput(null)).toBe('');
    });

    it('removes dangerous patterns but keeps normal content', () => {
      const input = 'Hello <script>alert(1)</script> world javascript: onload=1 <iframe>bad</iframe> <object>obj</object> <embed />';
      const result = sanitizeInput(input);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onload=');
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
      expect(result).toContain('Hello');
      expect(result).toContain('world');
    });

    it('trims result', () => {
      const result = sanitizeInput('   safe content   ');
      expect(result).toBe('safe content');
    });
  });

  describe('isSafeUrl', () => {
    it('returns false for empty, non-string or invalid URL', () => {
      expect(isSafeUrl('')).toBe(false);
      // @ts-expect-error intentional invalid type
      expect(isSafeUrl(undefined)).toBe(false);
      // @ts-expect-error intentional invalid type
      expect(isSafeUrl(null)).toBe(false);
      expect(isSafeUrl('not-a-url')).toBe(false);
    });

    it('allows only http and https with no dangerous patterns', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
      expect(isSafeUrl('https://example.com/path?x=1')).toBe(true);
    });

    it('rejects URLs with dangerous protocols or patterns', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,AAAA')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('https://example.com/<script>alert(1)</script>')).toBe(false);
    });

    it('rejects non-http/https protocols', () => {
      expect(isSafeUrl('ftp://example.com')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('mailto:test@example.com')).toBe(false);
    });
  });

  describe('isValidTokenFormat', () => {
    it('returns false for empty, short or non-string tokens', () => {
      expect(isValidTokenFormat('')).toBe(false);
      expect(isValidTokenFormat('   ')).toBe(false);
      expect(isValidTokenFormat('short')).toBe(false);
      // @ts-expect-error intentional invalid type
      expect(isValidTokenFormat(undefined)).toBe(false);
      // @ts-expect-error intentional invalid type
      expect(isValidTokenFormat(null)).toBe(false);
    });

    it('returns false for tokens with dangerous patterns', () => {
      expect(isValidTokenFormat('<script>alert(1)</script>')).toBe(false);
      expect(isValidTokenFormat('javascript:alert(1)')).toBe(false);
    });

    it('returns true for reasonably long safe tokens', () => {
      expect(isValidTokenFormat('abcdef1234567890')).toBe(true);
      expect(isValidTokenFormat('token_with_underscores_123456')).toBe(true);
    });
  });

  describe('isTokenExpired', () => {
    it('returns false when expiresAt is not provided', () => {
      expect(isTokenExpired()).toBe(false);
      expect(isTokenExpired({})).toBe(false);
    });

    it('handles numeric expiresAt in the past and future', () => {
      const past = Date.now() - 1000;
      const future = Date.now() + 1000 * 60;

      expect(isTokenExpired({ expiresAt: past })).toBe(true);
      expect(isTokenExpired({ expiresAt: future })).toBe(false);
    });

    it('handles string expiresAt', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const futureDate = new Date(Date.now() + 1000 * 60).toISOString();

      expect(isTokenExpired({ expiresAt: pastDate })).toBe(true);
      expect(isTokenExpired({ expiresAt: futureDate })).toBe(false);
    });
  });
});
