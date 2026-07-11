export type GoogleSignInButtonTheme = 'outline' | 'filled_black';

export function getGoogleSignInButtonTheme(isDark: boolean): GoogleSignInButtonTheme {
  return isDark ? 'filled_black' : 'outline';
}
