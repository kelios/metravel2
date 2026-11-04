export type WalkRound = {
  order: number[]
  cursor: number
  completed: number
  phase: 'cards' | 'finale' | 'done'
}

export function startWalkRound(cardCount: number): WalkRound {
  const order = Array.from({ length: cardCount }, (_, index) => index)
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[other]] = [order[other], order[index]]
  }
  return { order, cursor: 0, completed: 0, phase: 'cards' }
}

export function advanceWalkRound(
  round: WalkRound,
  action: 'complete' | 'skip' | 'finish',
  goal: number,
): WalkRound {
  if (round.phase === 'done') return round
  if (round.phase === 'finale') {
    return action === 'finish' ? { ...round, phase: 'done' } : round
  }
  if (action === 'finish') return { ...round, phase: 'finale' }

  const completed = round.completed + Number(action === 'complete')
  const cursor = round.cursor + 1
  const phase = completed >= goal || cursor >= round.order.length ? 'finale' : 'cards'
  return { ...round, completed, cursor, phase }
}
