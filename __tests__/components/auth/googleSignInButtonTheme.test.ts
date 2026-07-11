import { getGoogleSignInButtonTheme } from '@/components/auth/googleSignInButtonTheme';

describe('getGoogleSignInButtonTheme', () => {
  it('uses the supported filled black Google theme in dark mode', () => {
    expect(getGoogleSignInButtonTheme(true)).toBe('filled_black');
  });

  it('uses the standard outline theme in light mode', () => {
    expect(getGoogleSignInButtonTheme(false)).toBe('outline');
  });
});
