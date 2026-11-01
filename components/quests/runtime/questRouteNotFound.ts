/**
 * #2896: публикация ответила 404/410 на клиентский запрос данных маршрута.
 * Документ на такой адрес сервер по-прежнему отдаёт кодом 404 (nginx кладёт
 * поверх него оболочку `+not-found.html`), а вот клиентский переход — после
 * гидратации этой оболочки или по ссылке — expo-router делает отдельным запросом
 * `/_expo/loaders/...`: брошенный там 404 превращался в
 * `Failed to load loader data for route` и экран ошибки/пустоту вместо страницы
 * «Квест не найден». Маркер отдаёт экрану факт «нет такого адреса» данными.
 *
 * Отдельный модуль без импортов (#2931): клиентский экран проекции проверяет
 * маркер, не втягивая серверный loader (`questRouteLoader` → fetch/SEO-метаданные)
 * в eager-бандл — граница #2738.
 */
export type QuestRouteNotFound = { kind: 'not_found'; path: string; httpStatus: 404 | 410 };

export function isQuestRouteNotFound(data: unknown): data is QuestRouteNotFound {
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'not_found';
}
