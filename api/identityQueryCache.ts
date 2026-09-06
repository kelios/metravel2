import type { Query, QueryClient } from '@tanstack/react-query'

/**
 * #1829: сброс кэша React Query при смене владельца сессии.
 *
 * Ключи личных запросов исторически заводились и с `userId`, и без него
 * (`favorites(userId)` против `privacySettings()`), поэтому полнота ревизии
 * ключей не может быть единственной защитой: любой новый ключ без владельца
 * снова открыл бы личные данные следующему вошедшему. Сброс закрывает класс
 * целиком и не зависит от этой полноты, поэтому он умышленно устроен от
 * запрета: сносится всё, кроме явных исключений. Лишний сброс публичных данных
 * стоит одного запроса, пропущенный личный ключ — утечки.
 *
 * Единственное исключение — каталог квестов: у него уже есть собственный
 * механизм смены личности (`api/questsCatalogInvalidation.ts`), который держит
 * публичную часть списка на экране и снимает с неё только личные поля. Снос
 * каталога отсюда сломал бы его и вернул пустой экран на время запроса.
 */
const IDENTITY_EXEMPT_KEY_ROOTS = new Set<string>(['quests'])

const isDroppedOnIdentityChange = (query: Query): boolean => {
  const root = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey
  return !(typeof root === 'string' && IDENTITY_EXEMPT_KEY_ROOTS.has(root))
}

/**
 * Второй проход после `credentialsReady` закрывает гонку выхода: запрос,
 * стартовавший до сброса, мог долететь ещё со старой сессией и заново положить
 * в кэш данные ушедшего пользователя. Он выполняется только если личность с
 * момента сброса не сменилась снова — иначе он снёс бы данные уже нового
 * вошедшего.
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

/** Только для тестов и governance-проверок: что переживает смену владельца. */
export const identityExemptKeyRoots = (): readonly string[] => [...IDENTITY_EXEMPT_KEY_ROOTS]
