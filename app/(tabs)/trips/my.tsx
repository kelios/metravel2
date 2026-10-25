import MyTripsDashboard from '@/components/trips/MyTripsDashboard';
import TripsPageSeo from '@/components/trips/TripsPageSeo';
import { translate as i18nT } from '@/i18n';
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata';
import { getTripsRouteSeo } from '@/components/trips/TripsPageSeo';

export default function MyTripsScreen() {
  return (
    <>
      <TripsPageSeo
        fallbackTitle="myTrips"
      />
      <MyTripsDashboard />
    </>
  );
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  const seo = getTripsRouteSeo('myTrips')
  return routeMetadata({
    title: seo.title,
    description: i18nT('seoStatic:root.default.description'),
    canonical: seo.canonicalPath,
    ogType: 'website',
  });
}
