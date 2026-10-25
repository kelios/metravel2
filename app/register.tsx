import { Redirect } from 'expo-router';
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

export default function RegisterRedirect() {
  return <Redirect href="/registration" />;
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/register');
}
