// #2134: реестр кэша блокировок — формы данных, мгновенный вырез, guard после
// refetch/перезагрузки и полнота реестра (регресс-контроль Task Contract).
import fs from 'fs'
import path from 'path'
import { QueryClient } from '@tanstack/react-query'

import {
  BLOCK_EXEMPT_ROOTS,
  BLOCK_SENSITIVE_ENTRIES,
  BLOCK_SENSITIVE_QUERIES,
  applyAuthorBlock,
  getBlockedAuthorIds,
  installBlockedAuthorGuard,
  isAuthoredByBlocked,
  releaseAuthorBlock,
  resetBlockedAuthorStateForTests,
  subscribeAuthorBlock,
} from '@/api/blockSensitiveQueries'
import { stripCollection, stripCommentTree, travelAuthorIds } from '@/api/blockSensitiveShapes'
import { queryKeys } from '@/api/queryKeys'
import { commentKeys } from '@/hooks/comments/commentKeys'

const BLOCKED = 7
const travel = (id: number, userIds: string) => ({ id, userIds, name: `t${id}` })
const comment = (id: number, user: number, replies: any[] = []) => ({
  id,
  user,
  text: `c${id}`,
  thread: 1,
  sub_thread: null,
  depth: 0,
  replies_count: replies.length,
  replies,
})

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })

beforeEach(() => {
  resetBlockedAuthorStateForTests()
})

describe('travelAuthorIds', () => {
  it('reads CSV userIds, numbers, arrays, user objects and flat ids', () => {
    expect(travelAuthorIds({ userIds: '3, 7' })).toEqual([3, 7])
    expect(travelAuthorIds({ userIds: 7 })).toEqual([7])
    expect(travelAuthorIds({ user_ids: ['7', 9] })).toEqual([7, 9])
    expect(travelAuthorIds({ user: { id: '7' } })).toEqual([7])
    expect(travelAuthorIds({ author_id: 5 })).toEqual([5])
    expect(travelAuthorIds({ userIds: '' })).toEqual([])
    expect(travelAuthorIds(null)).toEqual([])
  })
})

describe('stripCollection', () => {
  const blocked = new Set([BLOCKED])

  it('filters arrays and keeps the same reference when nothing matches', () => {
    const list = [travel(1, '1'), travel(2, '7')]
    expect(stripCollection(list, travelAuthorIds, blocked)).toEqual([travel(1, '1')])
    const clean = [travel(1, '1')]
    expect(stripCollection(clean, travelAuthorIds, blocked)).toBe(clean)
  })

  it('updates envelopes and their counters', () => {
    const env = { data: [travel(1, '1'), travel(2, '7')], total: 2, count: '2' }
    expect(stripCollection(env, travelAuthorIds, blocked)).toEqual({ data: [travel(1, '1')], total: 1, count: 1 })
  })

  it('walks infinite pages and leaves untouched pages as is', () => {
    const page1 = { data: [travel(1, '1')], total: 3 }
    const page2 = { data: [travel(2, '7'), travel(3, '3,7')], total: 3 }
    const next = stripCollection({ pages: [page1, page2], pageParams: [0, 1] }, travelAuthorIds, blocked) as any
    expect(next.pages[0]).toBe(page1)
    expect(next.pages[1]).toEqual({ data: [], total: 1 })
  })

  it('filters id-keyed maps (popular / of-month)', () => {
    const map = { 1: travel(1, '1'), 2: travel(2, '7') }
    expect(stripCollection(map, travelAuthorIds, blocked)).toEqual({ 1: travel(1, '1') })
  })

  it('does nothing for an empty set', () => {
    const list = [travel(2, '7')]
    expect(stripCollection(list, travelAuthorIds, new Set())).toBe(list)
  })
})

describe('stripCommentTree', () => {
  it('removes the blocked author with their replies and fixes counters', () => {
    const reply = comment(3, 1)
    const blockedTop = comment(2, BLOCKED, [reply])
    const nestedBlocked = comment(5, BLOCKED)
    const kept = comment(4, 1, [nestedBlocked])
    const tree = {
      travel_id: 10,
      total_count: 5,
      top_level: [blockedTop, kept],
      flat: [blockedTop, reply, kept, nestedBlocked, comment(6, 1)],
    }
    const next = stripCommentTree(tree, new Set([BLOCKED])) as any
    expect(next.top_level.map((n: any) => n.id)).toEqual([4])
    expect(next.top_level[0].replies).toEqual([])
    expect(next.top_level[0].replies_count).toBe(0)
    expect(next.flat.map((c: any) => c.id)).toEqual([4, 6])
    expect(next.total_count).toBe(2)
  })

  it('returns the same tree without matches', () => {
    const tree = { travel_id: 1, total_count: 1, top_level: [comment(1, 1)], flat: [comment(1, 1)] }
    expect(stripCommentTree(tree, new Set([BLOCKED]))).toBe(tree)
  })
})

describe('applyAuthorBlock', () => {
  it('strips every registry list, patches the profile and notifies subscribers', () => {
    const qc = newClient()
    const untouched = { data: [travel(9, '1')], total: 1 }
    qc.setQueryData([...queryKeys.travels(), { perPage: 12 }], { pages: [{ data: [travel(1, '7'), travel(2, '1')], total: 2 }], pageParams: [0] })
    qc.setQueryData(queryKeys.travelsPopular(), { 1: travel(1, '7') })
    qc.setQueryData(['home-new-travels'], untouched)
    qc.setQueryData(commentKeys.travelComments(1, 0), [comment(1, BLOCKED), comment(2, 1)])
    qc.setQueryData(queryKeys.tripChatMessages('1', 5), [{ id: 1, senderId: BLOCKED }, { id: 2, senderId: 1 }])
    qc.setQueryData(queryKeys.publicTrips({}), [{ id: 1, organizer: { id: BLOCKED } }])
    qc.setQueryData(queryKeys.communityTrips({}), [{ id: 1, organizer: { id: 3 } }])
    qc.setQueryData(queryKeys.userProfile(String(BLOCKED)), { user: BLOCKED, is_blocked_by_me: false })
    const events: Array<[number, boolean]> = []
    subscribeAuthorBlock((id, blocked) => events.push([id, blocked]))

    applyAuthorBlock(qc, BLOCKED)

    expect((qc.getQueryData([...queryKeys.travels(), { perPage: 12 }]) as any).pages[0].data.map((t: any) => t.id)).toEqual([2])
    expect(qc.getQueryData(queryKeys.travelsPopular())).toEqual({})
    expect(qc.getQueryData(['home-new-travels'])).toBe(untouched)
    expect((qc.getQueryData(commentKeys.travelComments(1, 0)) as any[]).map((c) => c.id)).toEqual([2])
    expect(qc.getQueryData(queryKeys.tripChatMessages('1', 5))).toEqual([{ id: 2, senderId: 1 }])
    expect(qc.getQueryData(queryKeys.publicTrips({}))).toEqual([])
    expect(qc.getQueryData(queryKeys.communityTrips({}))).toHaveLength(1)
    expect((qc.getQueryData(queryKeys.userProfile(String(BLOCKED))) as any).is_blocked_by_me).toBe(true)
    expect(events).toEqual([[BLOCKED, true]])
  })
})

describe('installBlockedAuthorGuard', () => {
  let owner: string | null = '1'
  const install = (qc: QueryClient) => installBlockedAuthorGuard(qc, { getOwner: () => owner })

  beforeEach(() => {
    owner = '1'
  })

  it('re-strips a refetched response after an optimistic block', () => {
    const qc = newClient()
    const stop = install(qc)
    applyAuthorBlock(qc, BLOCKED)

    // Ответ, пришедший после блока (refetch), снова содержит автора.
    qc.setQueryData(queryKeys.travelsNear(1), [travel(1, '7'), travel(2, '1')])
    expect((qc.getQueryData(queryKeys.travelsNear(1)) as any[]).map((t) => t.id)).toEqual([2])
    stop()
  })

  it('uses the loaded blocked list after a reload and hides nothing for a guest', () => {
    const qc = newClient()
    qc.setQueryData(queryKeys.userTravels('7'), { data: [travel(1, '7')], total: 1 })
    const stop = install(qc)
    expect(getBlockedAuthorIds().size).toBe(0)

    // Старт сессии: список заблокированных загрузился — guard режет уже лежащее в кэше.
    qc.setQueryData(queryKeys.myBlockedUsers('1'), [{ id: 100, user: BLOCKED }])
    expect(qc.getQueryData(queryKeys.userTravels('7'))).toEqual({ data: [], total: 0 })
    expect(isAuthoredByBlocked({ userIds: '7' })).toBe(true)

    // Гость: набор пуст, ничего не режется.
    owner = null
    expect(getBlockedAuthorIds().size).toBe(0)
    qc.setQueryData(queryKeys.travelsNear(2), [travel(5, '7')])
    expect(qc.getQueryData(queryKeys.travelsNear(2))).toHaveLength(1)
    stop()
  })

  it('drops optimistic ids of the previous session owner', () => {
    const qc = newClient()
    const stop = install(qc)
    applyAuthorBlock(qc, BLOCKED)
    expect(getBlockedAuthorIds().has(BLOCKED)).toBe(true)
    owner = '2'
    expect(getBlockedAuthorIds().has(BLOCKED)).toBe(false)
    stop()
  })

  it('stops hiding after release (rollback / unblock)', () => {
    const qc = newClient()
    const stop = install(qc)
    applyAuthorBlock(qc, BLOCKED)
    releaseAuthorBlock(BLOCKED)
    qc.setQueryData(queryKeys.travelsNear(1), [travel(1, '7')])
    expect(qc.getQueryData(queryKeys.travelsNear(1))).toHaveLength(1)
    stop()
  })
})

// ---- Полнота реестра ------------------------------------------------------------

const rootOf = (factory: (...args: any[]) => readonly unknown[]): string =>
  String(factory(...new Array(Math.max(factory.length, 1)).fill(undefined))[0])

const SOURCE_DIRS = ['api', 'app', 'components', 'context', 'hooks', 'screens', 'services', 'stores', 'utils']
const AD_HOC_KEY = /queryKey:\s*\[\s*['"]([^'"]+)['"]/g
const JSX_KEY_PROP = /queryKey="([^"]+)"/g

const collectSourceRoots = (): Map<string, string> => {
  const roots = new Map<string, string>()
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '__tests__') walk(full)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const source = fs.readFileSync(full, 'utf8')
        for (const re of [AD_HOC_KEY, JSX_KEY_PROP]) {
          for (const match of source.matchAll(re)) roots.set(match[1], full)
        }
      }
    }
  }
  SOURCE_DIRS.forEach((dir) => walk(path.join(process.cwd(), dir)))
  return roots
}

describe('registry completeness', () => {
  const registryRoots = BLOCK_SENSITIVE_ENTRIES.map((entry) => String(entry.key[0]))
  const isClassified = (root: string) => registryRoots.includes(root) || root in BLOCK_EXEMPT_ROOTS

  it('exports the registry keys (Task Contract)', () => {
    expect(BLOCK_SENSITIVE_QUERIES).toHaveLength(BLOCK_SENSITIVE_ENTRIES.length)
    expect(new Set(registryRoots).size).toBe(registryRoots.length)
  })

  it('classifies every queryKeys and commentKeys root', () => {
    const roots = Object.values(queryKeys).map((factory) => rootOf(factory as any))
    roots.push(String(commentKeys.all[0]))
    expect(roots.filter((root) => !isClassified(root))).toEqual([])
  })

  it('classifies every ad-hoc query key root in the sources', () => {
    const unclassified = [...collectSourceRoots().entries()]
      .filter(([root]) => !isClassified(root))
      .map(([root, file]) => `${root} (${path.relative(process.cwd(), file)})`)
    expect(unclassified).toEqual([])
  })

  it('never lists a root both as sensitive and exempt, and every exemption has a reason', () => {
    expect(registryRoots.filter((root) => root in BLOCK_EXEMPT_ROOTS)).toEqual([])
    Object.values(BLOCK_EXEMPT_ROOTS).forEach((reason) => expect(reason.trim()).not.toBe(''))
  })
})
