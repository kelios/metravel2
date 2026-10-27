import { useContext, useEffect } from 'react';
import { ThemeContext } from '@/hooks/useTheme';
import { useLocaleRevision } from '@/i18n/useLocaleRevision';
import { ErrorFallbackView, isExpoLoaderError } from './ErrorBoundary';

/**
 * Screen-level boundary for failed Expo Router loaders (#2822): the navigator and the URL stay
 * mounted, so "Try again" re-renders the same screen instead of the app resetting to "/".
 * Every other error is rethrown to the app ErrorBoundary and keeps its handling.
 */
export default function LoaderScreenErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const theme = useContext(ThemeContext);
  useLocaleRevision();
  const loaderError = isExpoLoaderError(error);
  useEffect(() => {
    if (!loaderError) return;
    const { logError } = require('@/utils/logger');
    logError(error, { loaderScreenErrorBoundary: true });
  }, [error, loaderError]);
  if (!loaderError) throw error;
  return <ErrorFallbackView error={error} onRetry={() => { void retry(); }} isDark={theme?.isDark ?? false} />;
}
