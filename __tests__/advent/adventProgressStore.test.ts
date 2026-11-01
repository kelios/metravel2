import { buildAdventOwnerKey, selectAdventOwnerProgress, useAdventProgressStore } from '@/stores/adventProgressStore'

describe('adventProgressStore (#2861)', () => {
  beforeEach(() => {
    useAdventProgressStore.setState({ byOwner: {} })
  })

  it('scopes progress by owner: guest and two accounts do not see each other', () => {
    const { openDoor, completeTask } = useAdventProgressStore.getState()
    openDoor('guest', 1, '2026-12-01')
    openDoor('u1', 1, '2026-12-01')
    completeTask('u1', 1, '2026-12-01')
    openDoor('u2', 2, '2026-12-02')

    const state = useAdventProgressStore.getState()
    expect(selectAdventOwnerProgress('guest')(state)).toEqual({ opened: { '1': '2026-12-01' }, tasksDone: {} })
    expect(selectAdventOwnerProgress('u1')(state)).toEqual({ opened: { '1': '2026-12-01' }, tasksDone: { '1': '2026-12-01' } })
    expect(selectAdventOwnerProgress('u2')(state)).toEqual({ opened: { '2': '2026-12-02' }, tasksDone: {} })
    expect(selectAdventOwnerProgress(null)(state)).toEqual({ opened: {}, tasksDone: {} })
  })

  it('keeps the first opening date and marks the door opened when a task completes first', () => {
    const { openDoor, completeTask } = useAdventProgressStore.getState()
    openDoor('u1', 3, '2026-12-03')
    openDoor('u1', 3, '2026-12-05')
    completeTask('u1', 4, '2026-12-05')
    const progress = selectAdventOwnerProgress('u1')(useAdventProgressStore.getState())
    expect(progress.opened['3']).toBe('2026-12-03')
    expect(progress.opened['4']).toBe('2026-12-05')
    expect(progress.tasksDone['4']).toBe('2026-12-05')
  })

  it('resets one owner without touching the others', () => {
    const { openDoor, resetOwner } = useAdventProgressStore.getState()
    openDoor('guest', 1, '2026-12-01')
    openDoor('u1', 1, '2026-12-01')
    resetOwner('guest')
    const state = useAdventProgressStore.getState()
    expect(state.byOwner.guest).toBeUndefined()
    expect(state.byOwner.u1).toBeDefined()
  })

  it('derives the owner key from auth identity', () => {
    expect(buildAdventOwnerKey({ isAuthenticated: false, authReady: true })).toBe('guest')
    expect(buildAdventOwnerKey({ isAuthenticated: true, userId: 42, authReady: true })).toBe('u42')
    expect(buildAdventOwnerKey({ isAuthenticated: true, userId: null, authReady: true })).toBeNull()
    expect(buildAdventOwnerKey({ isAuthenticated: false, authReady: false })).toBeNull()
  })
})
