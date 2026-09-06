// #1829: часть личных ключей кэша не несёт владельца, поэтому на общем
// устройстве следующий вошедший читал ячейку предыдущего. Утечку закрывает
// сброс кэша на смене владельца (`api/identityQueryCache.ts`), а этот набор
// держит вторую половину: список личных ключей без владельца зафиксирован и не
// растёт молча, а офлайн-персист по-прежнему уносит на диск только те ключи,
// которые владельца несут.

import fs from 'node:fs'
import path from 'node:path'
import type { Query } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { shouldPersistQuery } from '@/utils/queryPersist'

const source = fs.readFileSync(path.resolve(process.cwd(), 'api/queryKeys.ts'), 'utf8')

type Factory = { name: string; args: string; body: string }

const factories: Factory[] = [
  ...source.matchAll(/^ {2}([a-zA-Z]\w*):\s*\(([^)]*)\)\s*=>\s*([\s\S]*?)as const,/gm),
].map(([, name, args, body]) => ({ name, args, body: body.replace(/\s+/g, ' ').trim() }))

/**
 * Корни, под которыми в этом файле лежат исключительно личные данные. Имя ключа
 * их не выдаёт: `privacySettings` и `stravaStatus` личные, но ни `my`, ни `me` в
 * них нет. Каталоги и справочники под этими корнями не живут.
 */
const PERSONAL_KEY_ROOTS = new Set<string>([
  'contact-requests',
  'my-subscribers',
  'my-subscriptions',
  'privacy',
  'security',
  'strava',
  'telegram-link',
  'trip-notifications',
  'user-blocked',
  'user-verifications',
  'userPointsAll',
])

const keyRoot = ({ body }: Factory): string | null => /^\[\s*'([^']+)'/.exec(body)?.[1] ?? null

/**
 * Личный ключ виден либо по имени (`my*`, `*Me`, `*Mine`, сегмент `'me'`), либо
 * по корню из списка выше. Хелперы инвалидации по префиксу (`*All`, `*Root`)
 * данных не держат — под ними ничего не лежит, они только адресуют поддерево.
 *
 * Эвристика не претендует на то, чтобы угадать любой личный ключ: она ловит те
 * формы, которыми личные ключи заводят в этом файле. Утечку закрывает не она, а
 * сброс кэша на смене владельца (`api/identityQueryCache.ts`) — он устроен от
 * запрета и сносит всё, кроме точного ключа каталога квестов.
 */
const looksPersonal = (factory: Factory): boolean => {
  const { name, body } = factory
  if (name.endsWith('All') || name.endsWith('Root')) return false
  const root = keyRoot(factory)
  return (
    /^my[A-Z]/.test(name) ||
    name.endsWith('Me') ||
    name.endsWith('Mine') ||
    /'me'/.test(body) ||
    (root !== null && PERSONAL_KEY_ROOTS.has(root))
  )
}

const carriesOwner = ({ args }: Factory): boolean => /\buserId\b/.test(args)

/**
 * Долг #1829, пункт 2: личные ключи, которые владельца пока не несут. Пока они
 * здесь, их прикрывает сброс кэша на смене владельца. Список — чеклист: ключ
 * уходит отсюда ровно тогда, когда получает `userId`.
 */
const PERSONAL_KEYS_WITHOUT_OWNER = [
  'achievementsMe',
  'achievementsRareMe',
  'contactRequests',
  'gamificationCharacterMe',
  'gamificationPlaceBadgesMe',
  'gamificationProgressMe',
  'myBlockedUsers',
  'mySubscribers',
  'mySubscriptions',
  'myTelegramLink',
  'myVerifications',
  'plannedTripsMine',
  'privacySettings',
  'securityJournal',
  'stravaActivities',
  'stravaActivity',
  'stravaStatus',
  'tripChatMessages',
  'tripMyApplications',
  'tripNotifications',
  'userPointsAll',
  'userPointsPagination',
].sort()

describe('#1829 владелец в ключах кэша', () => {
  it('разбирает файл ключей, а не пустоту', () => {
    expect(factories.length).toBeGreaterThan(50)
    expect(factories.map((f) => f.name)).toEqual(expect.arrayContaining(['favorites', 'privacySettings']))
  })

  it('новый личный ключ обязан нести владельца или быть в списке долга', () => {
    const unscoped = factories
      .filter((factory) => looksPersonal(factory) && !carriesOwner(factory))
      .map((factory) => factory.name)
      .filter((name) => !PERSONAL_KEYS_WITHOUT_OWNER.includes(name))

    expect(unscoped).toEqual([])
  })

  // Список долга — чеклист, а не свалка: имя в нём обязано существовать и
  // действительно не нести владельца, иначе оно останется там после починки.
  // Эвристика — это и есть правило; если она перестанет узнавать личные формы,
  // гейт молча пропустит следующий ключ без владельца.
  it('эвристика узнаёт личные ключи и по имени, и по корню', () => {
    const byName = new Map(factories.map((factory) => [factory.name, factory]))
    const personal = ['achievementsMe', 'mySubscriptions', 'plannedTripsMine', 'privacySettings', 'stravaStatus']
    const notPersonal = ['travels', 'questDetail', 'filterOptions', 'contactRequestsAll', 'stravaActivitiesRoot']

    expect({
      personal: personal.filter((name) => !looksPersonal(byName.get(name)!)),
      notPersonal: notPersonal.filter((name) => looksPersonal(byName.get(name)!)),
    }).toEqual({ personal: [], notPersonal: [] })
  })

  it('список долга не содержит ни выдуманных, ни уже починенных ключей', () => {
    const byName = new Map(factories.map((factory) => [factory.name, factory]))
    const stale = PERSONAL_KEYS_WITHOUT_OWNER.filter((name) => {
      const factory = byName.get(name)
      return !factory || carriesOwner(factory)
    })

    expect(stale).toEqual([])
  })

  it('образцовые личные ключи различают пользователей', () => {
    expect(queryKeys.favorites('A')).not.toEqual(queryKeys.favorites('B'))
    expect(queryKeys.questUserReview('A', 1)).not.toEqual(queryKeys.questUserReview('B', 1))
    expect(queryKeys.messagesUnreadCount('A')).not.toEqual(queryKeys.messagesUnreadCount('B'))
  })
})

describe('#1829 офлайн-персист уносит на диск только ключи с владельцем', () => {
  const persistedQuery = (queryKey: readonly unknown[]) =>
    ({ queryKey, state: { status: 'success' } } as unknown as Query)

  it('персистит офлайн-домены, и у каждого из них ключ различает пользователей', () => {
    const offlineDomains = [
      queryKeys.favorites,
      queryKeys.recommendations,
      queryKeys.viewHistory,
      queryKeys.travelStatus,
    ]

    for (const key of offlineDomains) {
      expect(shouldPersistQuery(persistedQuery(key('A')))).toBe(true)
      expect(key('A')).not.toEqual(key('B'))
    }
  })

  it('личные ключи без владельца на диск не уходят', () => {
    const unscoped = [
      queryKeys.privacySettings(),
      queryKeys.userPointsAll(),
      queryKeys.mySubscriptions(),
      queryKeys.myTelegramLink(),
      queryKeys.achievementsMe(),
      queryKeys.tripChatMessages(7),
    ]

    for (const queryKey of unscoped) {
      expect({ queryKey, persisted: shouldPersistQuery(persistedQuery(queryKey)) }).toEqual({
        queryKey,
        persisted: false,
      })
    }
  })
})
