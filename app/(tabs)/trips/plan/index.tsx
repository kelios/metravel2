import { Redirect } from 'expo-router';
import { shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

export default function PlannedTripsRedirect() {
  return <Redirect href="/trips/my" />;
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  // Redirect на /trips/my: собственного head у маршрута нет.
  return shellRouteMetadata({ robots: 'noindex, follow' });
}
