// #1829: часть личных ключей кэша не несёт владельца, поэтому на общем
// устройстве следующий вошедший читал ячейку предыдущего. Утечку закрывает
// сброс кэша на смене владельца (`api/identityQueryCache.ts`), а этот набор
// держит вторую половину: личный ключ обязан нести владельца, и офлайн-персист
// уносит на диск только те ключи, которые его несут.
//
// #1831 закрыл долг: список личных ключей без владельца пуст, поэтому гейт из
// реестра долга превратился в правило — новый личный ключ без `userId` валит
// набор сразу.

import fs from 'node:fs'
import path from 'node:path'
import { QueryClient, type Query } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { dropQueryCacheForIdentityChange } from '@/api/identityQueryCache'
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
  'quest-progress',
  'security',
  'strava',
  'telegram-link',
  'trip-chat-messages',
  'trip-notifications',
  'user-blocked',
  'user-verifications',
  'userPointsAll',
])

const keyRoot = ({ body }: Factory): string | null => /^\[\s*'([^']+)'/.exec(body)?.[1] ?? null

/**
 * Хелпер инвалидации по префиксу данных не держит: под ним ничего не лежит, он
 * только адресует поддерево. Отличает его не имя, а ОТСУТСТВИЕ параметров —
 * адресовать поддерево целиком не от чего параметризовать. Имени мало:
 * `userPointsAll(userId)` и `questProgressAll(userId)` тоже кончаются на `All`,
 * но держат личную коллекцию, и ранний выход по имени вывел бы их из-под
 * правила — вернулся бы ровно тот долг, который закрывал #1831.
 */
const isPrefixHelper = ({ name, args }: Factory): boolean =>
  (name.endsWith('All') || name.endsWith('Root')) && args.trim() === ''

/**
 * Личный ключ виден либо по имени (`my*`, `*Me`, `*Mine`, сегмент `'me'`), либо
 * по корню из списка выше.
 *
 * Эвристика не претендует на то, чтобы угадать любой личный ключ: она ловит те
 * формы, которыми личные ключи заводят в этом файле. Утечку закрывает не она, а
 * сброс кэша на смене владельца (`api/identityQueryCache.ts`) — он устроен от
 * запрета и сносит всё, кроме точного ключа каталога квестов.
 */
const looksPersonal = (factory: Factory): boolean => {
  const { name, body } = factory
  if (isPrefixHelper(factory)) return false
  const root = keyRoot(factory)
  return (
    /^my[A-Z]/.test(name) ||
    name.endsWith('Me') ||
    name.endsWith('Mine') ||
    /'me'/.test(body) ||
    (root !== null && PERSONAL_KEY_ROOTS.has(root))
  )
}

/**
 * Владельца мало ПРИНЯТЬ — его обязано нести само тело ключа. Параметр
 * `userId`, не попавший в массив, кэш не разделяет, а гейт по одной сигнатуре
 * такой ключ пропустил бы. Для нынешних двадцати двух это доказано ниже
 * сравнением значений, здесь то же правило распространяется на будущие.
 */
const carriesOwner = ({ args, body }: Factory): boolean =>
  /\buserId\b/.test(args) && /\buserId\b/.test(body)

/**
 * Долг #1829, пункт 2, закрыт в #1831: все двадцать два личных ключа получили
 * `userId`. Список остаётся пустым намеренно — это не рудимент, а форма правила:
 * новый личный ключ без владельца обязан либо получить его, либо быть внесён
 * сюда явным решением, а не просочиться молча.
 */
const PERSONAL_KEYS_WITHOUT_OWNER: string[] = []

describe('#1829 владелец в ключах кэша', () => {
  it('разбирает файл ключей, а не пустоту', () => {
    expect(factories.length).toBeGreaterThan(50)
    expect(factories.map((f) => f.name)).toEqual(expect.arrayContaining(['favorites', 'privacySettings']))
  })

  it('личный ключ обязан нести владельца, если он не внесён в список долга', () => {
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
    const personal = [
      'achievementsMe',
      'mySubscriptions',
      'plannedTripsMine',
      'privacySettings',
      'stravaStatus',
      'tripChatMessages',
    ]
    // `userPointsAll` кончается на `All`, но это ключ самой коллекции, а не
    // хелпер: он принимает владельца и держит данные.
    const personalDespiteAllSuffix = ['userPointsAll', 'questProgressAll']
    const notPersonal = ['travels', 'questCityClassification', 'filterOptions', 'contactRequestsAll', 'stravaActivitiesRoot']

    expect({
      personal: personal.filter((name) => !looksPersonal(byName.get(name)!)),
      personalDespiteAllSuffix: personalDespiteAllSuffix.filter(
        (name) => !looksPersonal(byName.get(name)!),
      ),
      notPersonal: notPersonal.filter((name) => looksPersonal(byName.get(name)!)),
    }).toEqual({ personal: [], personalDespiteAllSuffix: [], notPersonal: [] })
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

  // #1831: перевод ключа на `userId` без проверки самого значения ничего не
  // доказывает — владельца можно принять и не положить в ключ. Каждый бывший
  // должник обязан отдать разные ключи двум разным пользователям.
  it('каждый бывший должник различает пользователей значением, а не сигнатурой', () => {
    const sameForBothOwners = ([
      ['achievementsMe', (id: string) => queryKeys.achievementsMe(id, 'ru')],
      ['achievementsRareMe', (id: string) => queryKeys.achievementsRareMe(id, 'ru')],
      ['contactRequests', (id: string) => queryKeys.contactRequests(id, 'incoming')],
      ['gamificationCharacterMe', (id: string) => queryKeys.gamificationCharacterMe(id)],
      ['gamificationPlaceBadgesMe', (id: string) => queryKeys.gamificationPlaceBadgesMe(id)],
      ['gamificationProgressMe', (id: string) => queryKeys.gamificationProgressMe(id)],
      ['myBlockedUsers', (id: string) => queryKeys.myBlockedUsers(id)],
      ['mySubscribers', (id: string) => queryKeys.mySubscribers(id)],
      ['mySubscriptions', (id: string) => queryKeys.mySubscriptions(id)],
      ['myTelegramLink', (id: string) => queryKeys.myTelegramLink(id)],
      ['myVerifications', (id: string) => queryKeys.myVerifications(id)],
      ['plannedTripsMine', (id: string) => queryKeys.plannedTripsMine(id)],
      ['privacySettings', (id: string) => queryKeys.privacySettings(id)],
      ['securityJournal', (id: string) => queryKeys.securityJournal(id)],
      ['stravaActivities', (id: string) => queryKeys.stravaActivities(id, { page: 1 })],
      ['stravaActivity', (id: string) => queryKeys.stravaActivity(id, 7)],
      ['stravaStatus', (id: string) => queryKeys.stravaStatus(id)],
      ['tripChatMessages', (id: string) => queryKeys.tripChatMessages(id, 7)],
      ['tripMyApplications', (id: string) => queryKeys.tripMyApplications(id)],
      ['tripNotifications', (id: string) => queryKeys.tripNotifications(id)],
      ['userPointsAll', (id: string) => queryKeys.userPointsAll(id)],
      ['userPointsPagination', (id: string) => queryKeys.userPointsPagination(id)],
    ] as const)
      .filter(([, build]) => JSON.stringify(build('A')) === JSON.stringify(build('B')))
      .map(([name]) => name)

    expect(sameForBothOwners).toEqual([])
  })

  // Владелец обязан стоять сразу за общим корнем, а не в конце кортежа.
  // Механическое добавление в конец разорвало бы адресацию поддерева молча:
  // хелпер `*All` перестал бы матчить своего потомка, и инвалидация промахнулась
  // бы мимо живого запроса — не утечка, а тихо не обновляющийся экран.
  it('префиксные хелперы по-прежнему адресуют своё поддерево', () => {
    const isPrefixOf = (parent: readonly unknown[], child: readonly unknown[]) =>
      parent.every((segment, i) => JSON.stringify(segment) === JSON.stringify(child[i]))

    const broken = ([
      ['plannedTripsAll → plannedTripsMine', queryKeys.plannedTripsAll(), queryKeys.plannedTripsMine('A')],
      ['contactRequestsAll → contactRequests', queryKeys.contactRequestsAll(), queryKeys.contactRequests('A', 'incoming')],
      ['stravaActivitiesRoot → stravaActivities', queryKeys.stravaActivitiesRoot(), queryKeys.stravaActivities('A', { page: 1 })],
      // Отметка полноты коллекции точек: инвалидация `userPointsAll` обязана
      // задевать и её, иначе от снесённых данных остался бы признак
      // «докачано целиком» (#1709).
      ['userPointsAll → userPointsPagination', queryKeys.userPointsAll('A'), queryKeys.userPointsPagination('A')],
    ] as const)
      .filter(([, parent, child]) => !isPrefixOf(parent, child))
      .map(([label]) => label)

    expect(broken).toEqual([])
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

  it('личные домены вне офлайн-списка на диск не уходят', () => {
    const notPersisted = [
      queryKeys.privacySettings('A'),
      queryKeys.userPointsAll('A'),
      queryKeys.mySubscriptions('A'),
      queryKeys.myTelegramLink('A'),
      queryKeys.achievementsMe('A', 'ru'),
      queryKeys.tripChatMessages('A', 7),
    ]

    for (const queryKey of notPersisted) {
      expect({ queryKey, persisted: shouldPersistQuery(persistedQuery(queryKey)) }).toEqual({
        queryKey,
        persisted: false,
      })
    }
  })
})

describe('#2697 achievement locale keeps identity and privacy boundaries', () => {
  const locales = ['ru', 'be', 'uk', 'pl', 'en'] as const
  const localizedFactories = [
    (locale: typeof locales[number]) => queryKeys.achievementsBadges(locale),
    (locale: typeof locales[number]) => queryKeys.achievementsMe('A', locale),
    (locale: typeof locales[number]) => queryKeys.achievementsUser('A', 'viewer-A', locale),
    (locale: typeof locales[number]) => queryKeys.achievementsRareMe('A', locale),
    (locale: typeof locales[number]) => queryKeys.achievementsRareUser('A', locale),
  ]

  it('keeps five distinct language copies for each localized domain', () => {
    for (const build of localizedFactories) {
      expect(new Set(locales.map((locale) => JSON.stringify(build(locale)))).size).toBe(5)
    }
  })

  it.each(locales)('keeps private owners and public users separate in %s', (locale) => {
    expect(queryKeys.achievementsMe('A', locale)).not.toEqual(queryKeys.achievementsMe('B', locale))
    expect(queryKeys.achievementsRareMe('A', locale)).not.toEqual(queryKeys.achievementsRareMe('B', locale))
    expect(queryKeys.achievementsUser('A', 'viewer-A', locale)).not.toEqual(queryKeys.achievementsUser('B', 'viewer-A', locale))
    expect(queryKeys.achievementsRareUser('A', locale)).not.toEqual(queryKeys.achievementsRareUser('B', locale))
    expect(queryKeys.achievementsMe('A', locale)).not.toEqual(queryKeys.achievementsUser('A', 'viewer-A', locale))
    expect(queryKeys.achievementsRareMe('A', locale)).not.toEqual(queryKeys.achievementsRareUser('A', locale))
  })

  it('invalidates every warmed locale through the existing domain and identity prefix', async () => {
    const client = new QueryClient()
    const domains = [
      { prefix: queryKeys.achievementsBadgesAll(), build: localizedFactories[0] },
      { prefix: queryKeys.achievementsMeAll('A'), build: localizedFactories[1] },
      { prefix: queryKeys.achievementsUserAll('A'), build: localizedFactories[2] },
      { prefix: queryKeys.achievementsRareMeAll('A'), build: localizedFactories[3] },
      { prefix: queryKeys.achievementsRareUserAll('A'), build: localizedFactories[4] },
    ]
    try {
      for (const { prefix, build } of domains) {
        client.clear()
        const ownKeys = locales.map(build)
        const otherKeys = [
          queryKeys.achievementsMe('B', 'pl'),
          queryKeys.achievementsUser('B', 'viewer-A', 'pl'),
          queryKeys.achievementsRareMe('B', 'pl'),
          queryKeys.achievementsRareUser('B', 'pl'),
          queryKeys.achievementsTravelPeer(7, 'viewer-A'),
        ]
        for (const key of [...ownKeys, ...otherKeys]) client.setQueryData(key, { value: 'warm' })

        await client.invalidateQueries({ queryKey: prefix, refetchType: 'none' })

        expect(ownKeys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(locales.map(() => true))
        expect(otherKeys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(otherKeys.map(() => false))
      }
    } finally {
      client.clear()
    }
  })

  it('keeps all achievement language copies out of offline persistence and drops them on identity change', async () => {
    const client = new QueryClient()
    const keys = localizedFactories.flatMap((build) => locales.map(build))
    try {
      for (const key of keys) {
        client.setQueryData(key, { description: 'session content' })
        expect(shouldPersistQuery({ queryKey: key, state: { status: 'success' } } as unknown as Query)).toBe(false)
      }

      await dropQueryCacheForIdentityChange(client, () => true)

      expect(keys.map((key) => client.getQueryData(key))).toEqual(keys.map(() => undefined))
    } finally {
      client.clear()
    }
  })

  it('preserves public catalogue and neutral character/progression key shapes', () => {
    expect(queryKeys.achievementsPeerCatalog()).toEqual(['achievements', 'peer-catalog'])
    expect(queryKeys.achievementsTravelPeer(7, 'viewer-A')).toEqual(['achievements', 'travel-peer', '7', 'viewer-A'])
    expect(queryKeys.gamificationCharacterMe('A')).toEqual(['gamification', 'character', 'me', 'A'])
    expect(queryKeys.gamificationCharacterUser('A')).toEqual(['gamification', 'character', 'user', 'A'])
    expect(queryKeys.gamificationProgressMe('A')).toEqual(['gamification', 'progress', 'me', 'A'])
    expect(queryKeys.gamificationProgressUser('A')).toEqual(['gamification', 'progress', 'user', 'A'])
    expect(queryKeys.gamificationPlaceBadgesMe('A')).toEqual(['gamification', 'place-badges', 'me', 'A'])
    expect(queryKeys.gamificationPlaceBadgesUser('A')).toEqual(['gamification', 'place-badges', 'user', 'A'])
  })
})

describe('#2678 personalized peer state carries the viewer', () => {
  const viewers = [null, 'reader-A', 'reader-B'] as const

  it('uses the same public target for numeric article payloads and string profile routes', () => {
    expect(queryKeys.achievementsUser(42, 'reader-A', 'ru')).toEqual(queryKeys.achievementsUser('42', 'reader-A', 'ru'))
    expect(queryKeys.achievementsTravelPeer(7, 'reader-A')).toEqual(queryKeys.achievementsTravelPeer('7', 'reader-A'))
    expect(queryKeys.achievementsRareUser(42, 'ru')).toEqual(queryKeys.achievementsRareUser('42', 'ru'))
    expect(queryKeys.achievementsRareUserAll(42)).toEqual(queryKeys.achievementsRareUserAll('42'))
  })

  it('separates anonymous and different authenticated viewers for both author and article awards', () => {
    expect(new Set(viewers.map(viewer => JSON.stringify(queryKeys.achievementsUser(42, viewer, 'ru')))).size).toBe(3)
    expect(new Set(viewers.map(viewer => JSON.stringify(queryKeys.achievementsTravelPeer(7, viewer)))).size).toBe(3)
    for (const viewer of viewers) {
      expect(queryKeys.achievementsUser(42, viewer, 'ru')).not.toEqual(queryKeys.achievementsUser(42, viewer, 'pl'))
    }
  })

  it.each(['author', 'article'] as const)('invalidates all viewers and locales only for the awarded %s', async target => {
    const client = new QueryClient()
    const awarded = target === 'author'
      ? viewers.flatMap(viewer => ['ru', 'pl'].map(locale => queryKeys.achievementsUser('42', viewer, locale)))
      : viewers.map(viewer => queryKeys.achievementsTravelPeer('7', viewer))
    const others = [
      queryKeys.achievementsUser(99, 'reader-A', 'ru'),
      queryKeys.achievementsTravelPeer(99, 'reader-A'),
      queryKeys.achievementsMe('reader-B', 'ru'),
    ]
    try {
      for (const key of [...awarded, ...others]) client.setQueryData(key, { grantedByMe: true })
      await client.invalidateQueries({
        queryKey: target === 'author' ? queryKeys.achievementsUserAll(42) : queryKeys.achievementsTravelPeerAll(7),
        refetchType: 'none',
      })
      expect(awarded.map(key => client.getQueryState(key)?.isInvalidated)).toEqual(awarded.map(() => true))
      expect(others.map(key => client.getQueryState(key)?.isInvalidated)).toEqual(others.map(() => false))
    } finally {
      client.clear()
    }
  })
})
