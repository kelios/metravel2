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
  'trip-chat-messages',
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

  // #1831: перевод ключа на `userId` без проверки самого значения ничего не
  // доказывает — владельца можно принять и не положить в ключ. Каждый бывший
  // должник обязан отдать разные ключи двум разным пользователям.
  it('каждый бывший должник различает пользователей значением, а не сигнатурой', () => {
    const sameForBothOwners = ([
      ['achievementsMe', (id: string) => queryKeys.achievementsMe(id)],
      ['achievementsRareMe', (id: string) => queryKeys.achievementsRareMe(id)],
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
      queryKeys.achievementsMe('A'),
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
