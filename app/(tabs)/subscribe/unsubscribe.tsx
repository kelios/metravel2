import SubscriptionLinkResult from '@/components/subscribe/SubscriptionLinkResult';
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

// Ссылка из письма рассылки: /subscribe/unsubscribe?token=<token> (или ?status=… после редиректа бэка, #2122).
export default function SubscribeUnsubscribeScreen() {
  return <SubscriptionLinkResult action="unsubscribe" />;
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/subscribe/unsubscribe');
}
