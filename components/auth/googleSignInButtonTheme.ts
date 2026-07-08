export type GoogleSignInButtonTheme = 'outline' | 'outline_dark';

export function getGoogleSignInButtonTheme(isDark: boolean): GoogleSignInButtonTheme {
  return isDark ? 'outline_dark' : 'outline';
}
