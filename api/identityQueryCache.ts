import type { Query, QueryClient } from '@tanstack/react-query'

/**
 * #1829: сброс кэша React Query при смене владельца сессии.
 *
 * Ключи личных запросов исторически заводились и с `userId`, и без него
 * (`favorites(userId)` против `privacySettings()`), поэтому полнота ревизии
 * ключей не может быть единственной защитой: любой новый ключ без владельца
 * снова открыл бы личные данные следующему вошедшему. Сброс закрывает класс
 * целиком и не зависит от этой полноты, поэтому он умышленно устроен от
 * запрета: сносится всё, кроме единственного исключения. Лишний сброс
 * публичных данных стоит одного запроса, пропущенный личный ключ — утечки.
 *
 * Исключение ровно одно и ровно точное — сам каталог квестов `['quests']`. У
 * него есть собственный механизм смены личности
 * (`api/questsCatalogInvalidation.ts`), который держит публичную часть списка на
 * экране и снимает с неё личные поля; снос каталога отсюда сломал бы его и
 * вернул пустой экран на время запроса. Срезы под тем же корнем
 * (`questsPreview`, `questsCompactCatalog`, `questProgressAll`) под этот
 * механизм НЕ попадают — `catalogFilter` в нём `exact: true`, — а личные поля
 * `is_completed_by_me`/`user_rating` в них лежат. Поэтому исключение сверяет всю
 * форму ключа, а не только его корень.
 */
const QUESTS_CATALOG_KEY_ROOT = 'quests'

/** Что переживает смену владельца сессии. Экспортировано ради проверки состава. */
export const survivesIdentityChange = (queryKey: unknown): boolean =>
  Array.isArray(queryKey) && queryKey.length === 1 && queryKey[0] === QUESTS_CATALOG_KEY_ROOT

const isDroppedOnIdentityChange = (query: Query): boolean => !survivesIdentityChange(query.queryKey)

/**
 * Второй проход после `credentialsReady` закрывает гонку выхода: запрос,
 * стартовавший до сброса, мог долететь ещё со старой сессией и заново положить
 * в кэш данные ушедшего пользователя. Он выполняется только если личность с
 * момента сброса не сменилась снова — иначе он снёс бы данные уже нового
 * вошедшего. Оставшееся окно (ответ старой сессии лёг в кэш, и следующий
 * пользователь вошёл раньше, чем закрылась предыдущая сессия) закрывает сам
 * вызывающий: вход тоже считается сменой владельца, если в этом процессе уже
 * был вошедший пользователь.
 */
export function dropQueryCacheForIdentityChange(
  client: QueryClient,
  isCurrentIdentity: () => boolean,
  credentialsReady: Promise<void> = Promise.resolve(),
): Promise<void> {
  const filter = { predicate: isDroppedOnIdentityChange } as const
  const cancelled = client.cancelQueries(filter)
  client.removeQueries(filter)
  return Promise.all([cancelled, credentialsReady]).then(() => {
    if (!isCurrentIdentity()) return
    client.removeQueries(filter)
  })
}
