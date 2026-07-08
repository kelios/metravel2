import { getGoogleSignInButtonTheme } from '@/components/auth/googleSignInButtonTheme';

describe('getGoogleSignInButtonTheme', () => {
  it('uses the Google dark outline theme in dark mode', () => {
    expect(getGoogleSignInButtonTheme(true)).toBe('outline_dark');
  });

  it('uses the standard outline theme in light mode', () => {
    expect(getGoogleSignInButtonTheme(false)).toBe('outline');
  });
});
