import { advanceWalkRound, startWalkRound } from '@/components/games/walkRound'

describe('walk round', () => {
  it.each([5, 6])('presents the finale once players complete %i ordinary cards', goal => {
    let round = startWalkRound(11)
    for (let i = 0; i < goal; i++) {
      expect(round.phase).toBe('cards')
      round = advanceWalkRound(round, 'complete', goal)
    }
    expect(round).toMatchObject({ phase: 'finale', completed: goal })
  })

  it('serves every ordinary card once and ends on exhaustion even with no completions', () => {
    let round = startWalkRound(11)
    const seen = []
    while (round.phase === 'cards') {
      seen.push(round.order[round.cursor])
      round = advanceWalkRound(round, 'skip', 5)
    }
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 11 }, (_, i) => i))
    expect(round).toMatchObject({ phase: 'finale', completed: 0 })
  })

  it('allows an early finale, then finishes without changing the completed count', () => {
    const round = advanceWalkRound(startWalkRound(11), 'complete', 5)
    const finale = advanceWalkRound(round, 'finish', 5)
    expect(finale).toMatchObject({ phase: 'finale', completed: 1 })
    expect(advanceWalkRound(finale, 'skip', 5)).toBe(finale)
    const finished = advanceWalkRound(finale, 'finish', 5)
    expect(finished).toMatchObject({ phase: 'done', completed: 1 })
    expect(advanceWalkRound(finished, 'complete', 5)).toBe(finished)
    expect(startWalkRound(11)).toMatchObject({ phase: 'cards', completed: 0, cursor: 0 })
  })
})
