import SubscriptionLinkResult from '@/components/subscribe/SubscriptionLinkResult';

// Ссылка из письма рассылки: /subscribe/confirm?token=<token> (или ?status=… после редиректа бэка, #2122).
export default function SubscribeConfirmScreen() {
  return <SubscriptionLinkResult action="confirm" />;
}
