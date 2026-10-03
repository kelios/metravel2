/* global module */

/**
 * Страницы, на которые ведут ссылки из писем с одноразовым или бессрочным
 * секретом в query: подтверждение аккаунта, смена пароля, подтверждение и
 * отписка рассылки (#2121).
 *
 * Один источник для всех потребителей, чтобы новая «ссылка с токеном» не
 * забыла ни один из контуров:
 * - `app/+html.tsx` (`shouldNoindexPath`) — noindex до гидрации;
 * - `utils/analyticsInlineScript.ts` (`trackPage`) — секретные параметры
 *   вырезаются из URL до отправки в Метрику и GA4;
 * - governance-тест `__tests__/app/secretLinkRoutes.governance.test.ts`
 *   держит файл роута, запись noindex в `scripts/generate-seo-pages.js` и
 *   `robots="noindex, nofollow"` на экране.
 */

const SECRET_LINK_ROUTES = Object.freeze([
  Object.freeze({ route: '/accountconfirmation', secretParams: Object.freeze(['hash']) }),
  Object.freeze({ route: '/set-password', secretParams: Object.freeze(['password_reset_token']) }),
  Object.freeze({ route: '/subscribe/confirm', secretParams: Object.freeze(['token']) }),
  Object.freeze({ route: '/subscribe/unsubscribe', secretParams: Object.freeze(['token']) }),
]);

const SECRET_LINK_QUERY_PARAMS = Object.freeze(
  Array.from(new Set(SECRET_LINK_ROUTES.flatMap((entry) => entry.secretParams))),
);

const SECRET_LINK_ROUTE_PATHS = Object.freeze(SECRET_LINK_ROUTES.map((entry) => entry.route));

module.exports = {
  SECRET_LINK_ROUTES,
  SECRET_LINK_QUERY_PARAMS,
  SECRET_LINK_ROUTE_PATHS,
};
