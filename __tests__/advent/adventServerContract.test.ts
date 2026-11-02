import { ApiError } from '@/api/clientErrors'
import {
  isAdventBackendMissing,
  isValidAdventCampaign,
  isYearInReviewEmpty,
  normalizeAdventCampaign,
  normalizeAdventProgress,
  normalizeYearInReview,
} from '@/api/advent'
import campaign from '@/data/advent/2026.json'
import { alignServerOwnedTasks, hasUnsyncedAdventProgress, mergeAdventProgress } from '@/utils/advent/adventProgressMerge'
import { selectServerCreditedDays } from '@/utils/advent/adventCalendar'
import { buildAdventShareUrl } from '@/utils/advent/adventShare'
import { useAdventProgressStore } from '@/stores/adventProgressStore'

describe('advent server contract (#2867, #2868)', () => {
  it('normalizes progress: snake_case, valid days and ISO dates only, non-negative streak', () => {
    expect(
      normalizeAdventProgress({
        opened: { '1': '2026-12-01T10:00:00Z', x: '2026-12-02', '3': 5 },
        tasks_done: { '1': '2026-12-01' },
        streak: -4,
      }),
    ).toEqual({ opened: { '1': '2026-12-01' }, tasksDone: { '1': '2026-12-01' }, streak: 0 })
    expect(normalizeAdventProgress(null)).toEqual({ opened: {}, tasksDone: {}, streak: 0 })
  })

  it('accepts the bundled config shape from the server and rejects another year or broken doors', () => {
    expect(isValidAdventCampaign(campaign, 2026)).toBe(true)
    expect(isValidAdventCampaign(campaign, 2027)).toBe(false)
    expect(isValidAdventCampaign({ ...campaign, doors: [{ day: 1 }] }, 2026)).toBe(false)
    expect(isValidAdventCampaign('nope', 2026)).toBe(false)
  })

  it('bundled config flags the 10 site-action doors the server credits itself (#2940)', () => {
    expect([...selectServerCreditedDays(campaign.doors as never)]).toEqual([2, 4, 5, 7, 8, 10, 14, 20, 23, 26])
  })

  it('normalizes serverCredited to a strict boolean and keeps doors without it unchanged (#2940)', () => {
    const raw = JSON.parse(JSON.stringify(campaign))
    raw.doors[1].task.serverCredited = true
    raw.doors[3].task.serverCredited = 'yes'
    delete raw.doors[4].task.serverCredited
    const normalized = normalizeAdventCampaign(raw, 2026)
    expect(normalized?.doors[1].task.serverCredited).toBe(true)
    expect(normalized?.doors[3].task).not.toHaveProperty('serverCredited')
    expect(normalized?.doors[4].task).not.toHaveProperty('serverCredited')
    expect(normalized?.doors[4].task.text).toBe(raw.doors[4].task.text)
    expect(normalizeAdventCampaign(raw, 2027)).toBeNull()
  })

  it('server-credited tasks follow the server, not a dropped manual mark (#2940)', () => {
    const local = { opened: { '2': '2026-12-02', '3': '2026-12-03' }, tasksDone: { '2': '2026-12-02', '3': '2026-12-03' } }
    const days = new Set([2])
    expect(alignServerOwnedTasks(local, undefined, days).tasksDone).toEqual({ '3': '2026-12-03' })
    expect(alignServerOwnedTasks(local, { opened: {}, tasksDone: { '2': '2026-12-04' } }, days).tasksDone).toEqual({
      '2': '2026-12-04',
      '3': '2026-12-03',
    })
    expect(alignServerOwnedTasks(local, undefined, new Set())).toBe(local)
  })

  it('treats 404/501 as "backend not deployed" and other errors as real failures', () => {
    expect(isAdventBackendMissing(new ApiError(404, 'x'))).toBe(true)
    expect(isAdventBackendMissing(new ApiError(501, 'x'))).toBe(true)
    expect(isAdventBackendMissing(new ApiError(500, 'x'))).toBe(false)
    expect(isAdventBackendMissing(new Error('x'))).toBe(false)
  })

  it('normalizes year in review from lists or numbers and detects an empty year', () => {
    const full = normalizeYearInReview(
      {
        year: 2026,
        visited: { countries: ['Беларусь', { name: 'Польша' }], cities: 7, travels: [{ id: 1 }, { id: 2 }] },
        published_travels: 3,
        quests_completed: 2,
        badges_earned: [{ slug: 'a' }],
        longest_route_km: 812.6,
        first_subscription_author: { name: 'Анна' },
        advent: { opened: 24, streak: 20, completed: true },
      },
      2026,
    )
    expect(full.countries).toEqual({ count: 2, names: ['Беларусь', 'Польша'] })
    expect(full.cities).toEqual({ count: 7, names: [] })
    expect(full.visitedTravels).toBe(2)
    expect(full.badgesEarned).toBe(1)
    expect(full.longestRouteKm).toBe(813)
    expect(full.firstSubscriptionAuthor).toBe('Анна')
    expect(full.advent).toEqual({ opened: 24, streak: 20, completed: true })
    expect(isYearInReviewEmpty(full)).toBe(false)

    const empty = normalizeYearInReview({ visited: {}, advent: {} }, 2026)
    expect(empty.year).toBe(2026)
    expect(isYearInReviewEmpty(empty)).toBe(true)
  })

  it('merges progress as a union with the earliest date; a done task implies an opened door', () => {
    const merged = mergeAdventProgress(
      { opened: { '1': '2026-12-03', '2': '2026-12-02' }, tasksDone: {} },
      { opened: { '1': '2026-12-01' }, tasksDone: { '5': '2026-12-06' } },
    )
    expect(merged).toEqual({
      opened: { '1': '2026-12-01', '2': '2026-12-02', '5': '2026-12-06' },
      tasksDone: { '5': '2026-12-06' },
    })
    expect(hasUnsyncedAdventProgress({ opened: { '1': '2026-12-01' }, tasksDone: {} }, merged)).toBe(false)
    expect(hasUnsyncedAdventProgress({ opened: { '3': '2026-12-03' }, tasksDone: {} }, merged)).toBe(true)
    expect(hasUnsyncedAdventProgress({ opened: { '2': '2026-12-01' }, tasksDone: {} }, merged)).toBe(true)
  })

  it('store: mergeOwner unions server data, adoptGuest moves guest progress into the account once', () => {
    useAdventProgressStore.setState({
      byOwner: {
        guest: { opened: { '1': '2026-12-01' }, tasksDone: {} },
        u7: { opened: { '2': '2026-12-02' }, tasksDone: {} },
      },
    })
    const { adoptGuest, mergeOwner } = useAdventProgressStore.getState()
    expect(adoptGuest('u7')).toBe(true)
    expect(adoptGuest('u7')).toBe(false)
    expect(adoptGuest('guest')).toBe(false)
    mergeOwner('u7', { opened: {}, tasksDone: { '3': '2026-12-03' } })
    const state = useAdventProgressStore.getState().byOwner
    expect(state.guest).toBeUndefined()
    expect(state.u7).toEqual({
      opened: { '1': '2026-12-01', '2': '2026-12-02', '3': '2026-12-03' },
      tasksDone: { '3': '2026-12-03' },
    })
  })

  it('builds the share link to /advent with UTM attribution', () => {
    const url = buildAdventShareUrl({ channel: 'copy', year: 2026, kind: 'progress' })
    expect(url).toMatch(/\/advent\?/)
    expect(url).toContain('utm_source=copy')
    expect(url).toContain('utm_medium=referral')
    expect(url).toContain('utm_campaign=advent_2026_progress')
  })
})
