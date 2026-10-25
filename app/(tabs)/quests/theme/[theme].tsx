import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

/** Static `theme` segment takes precedence over the quest-detail city segment. */
export default function QuestThemeRedirect() {
    const { theme } = useLocalSearchParams<{ theme?: string | string[] }>();
    const value = typeof theme === 'string' ? theme : '';
    return <Redirect href={{ pathname: '/quests', params: { theme: value } }} />;
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return shellRouteMetadata({ robots: 'noindex, follow' });
}
