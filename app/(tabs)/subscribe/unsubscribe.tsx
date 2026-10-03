import SubscriptionLinkResult from '@/components/subscribe/SubscriptionLinkResult';

// Ссылка из письма рассылки: /subscribe/unsubscribe?token=<token> (или ?status=… после редиректа бэка, #2122).
export default function SubscribeUnsubscribeScreen() {
  return <SubscriptionLinkResult action="unsubscribe" />;
}
