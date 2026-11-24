import { useState } from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import AdventDoorSheet from '@/components/advent/AdventDoorSheet'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { useAdventRegionStore } from '@/stores/adventRegionStore'

import AdventFortuneTask from '@/components/advent/tasks/AdventFortuneTask'
import AdventMatchTask from '@/components/advent/tasks/AdventMatchTask'
import AdventPickTask from '@/components/advent/tasks/AdventPickTask'
import AdventSelfcheckTask from '@/components/advent/tasks/AdventSelfcheckTask'
import { applyAdventOverlay } from '@/services/advent/applyOverlay'
import type { AdventCampaignConfig, AdventDoor, AdventFortuneGame, AdventMatchGame, AdventPickGame, AdventSelfcheckGame } from '@/types/advent'
import { adventFortuneIndex, adventMatchOrder, adventPickVerdict, adventSelfcheckTier, adventTaskCreditsOnOpen, adventTaskGame } from '@/utils/advent/adventGames'
import { adventDoorRegions, defaultAdventRegion, resolveAdventDoor } from '@/utils/advent/adventVariants'

// Интересные дверцы (#3487) и варианты «Беларусь / Польша» (#3486).

jest.mock('@/components/ui/BottomSheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  return ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? React.createElement(View, null, children) : null)
})
jest.mock('@/context/AuthContext', () => ({
  useAuth: (select: (auth: { userId: string }) => unknown) => select({ userId: 'u1' }),
}))
jest.mock('@/hooks/useReduceMotion', () => ({
  ...jest.requireActual('@/hooks/useReduceMotion'),
  useReduceMotion: () => true,
}))

const selfcheck: AdventSelfcheckGame = {
  kind: 'selfcheck',
  items: ['a', 'b', 'c', 'd', 'e', 'f'],
  tiers: [
    { min: 3, title: 'Странник', text: 't2' },
    { min: 0, title: 'В начале пути', text: 't1' },
    { min: 6, title: 'Легенда', text: 't3', link: '/export', linkLabel: 'Книга' },
  ],
}

const match: AdventMatchGame = {
  kind: 'match',
  pairs: [
    { left: 'Виноград', right: 'Испания', fact: 'Двенадцать месяцев' },
    { left: 'Книги', right: 'Исландия' },
    { left: 'Бефана', right: 'Италия' },
  ],
}

const pick: AdventPickGame = {
  kind: 'pick',
  items: [
    { label: 'Термос', correct: true },
    { label: 'Шлёпки', correct: false, hint: 'не для снега' },
    { label: 'Фонарик', correct: true },
    { label: 'Фен', correct: false },
  ],
}

const SHARE = { year: 2026, preview: true }

describe('логика игр', () => {
  it('звание — наибольший порог не выше числа отметок, у нуля тоже есть звание', () => {
    expect(adventSelfcheckTier(selfcheck, 0)?.title).toBe('В начале пути')
    expect(adventSelfcheckTier(selfcheck, 2)?.title).toBe('В начале пути')
    expect(adventSelfcheckTier(selfcheck, 3)?.title).toBe('Странник')
    expect(adventSelfcheckTier(selfcheck, 6)?.title).toBe('Легенда')
  })

  it('рюкзак собран только без лишних и со всеми нужными', async () => {
    expect(adventPickVerdict(pick.items, new Set([0, 2]))).toEqual({ solved: true, missing: 0, extra: [] })
    expect(adventPickVerdict(pick.items, new Set([0, 1]))).toEqual({ solved: false, missing: 1, extra: [1] })
  })

  it('open с игрой не засчитывается открытием, битая игра ведёт задание по type', () => {
    expect(adventTaskCreditsOnOpen({ type: 'open', text: 't', game: pick })).toBe(false)
    expect(adventTaskCreditsOnOpen({ type: 'open', text: 't' })).toBe(true)
    const brokenMatch = { type: 'open', text: 't', game: { kind: 'match' } } as never
    expect(adventTaskGame(brokenMatch)).toBeNull()
    expect(adventTaskCreditsOnOpen(brokenMatch)).toBe(true)
    expect(adventTaskGame({ type: 'open', text: 't', game: { kind: 'quiz' } as never })).toBeNull()
  })

  it('правая колонка «пар» перемешана без совпадений напротив и детерминированно', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8]) {
      const order = adventMatchOrder(count)
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i))
      expect(order.some((value, index) => value === index)).toBe(false)
      expect(adventMatchOrder(count)).toEqual(order)
    }
  })
})

describe('варианты дверцы', () => {
  const door: AdventDoor = {
    day: 1,
    date: '2026-12-01',
    kind: 'content',
    region: 'pl',
    gift: { title: 'Торунь', text: 'pl' },
    task: { type: 'route', text: 'pl task', ctaRoute: '/quests', serverCredited: true },
    reward: { xp: 10 },
    variants: [{ region: 'by', gift: { title: 'Брест', text: 'by' }, task: { type: 'route', text: 'by task', ctaRoute: '/quests' } }],
  }

  it('подменяет подарок и задание, а зачёт сервера остаётся правилом дверцы', () => {
    const resolved = resolveAdventDoor(door, 'by')
    expect(resolved.gift.title).toBe('Брест')
    expect(resolved.task.text).toBe('by task')
    expect(resolved.task.serverCredited).toBe(true)
    expect(resolved.reward).toBe(door.reward)
    expect(resolveAdventDoor(door, 'pl')).toBe(door)
  })

  it('дверца без вариантов не меняется и переключателя не имеет', () => {
    const plain: AdventDoor = { ...door, region: undefined, variants: undefined }
    expect(resolveAdventDoor(plain, 'by')).toBe(plain)
    expect(adventDoorRegions(plain)).toEqual([])
    expect(adventDoorRegions(door)).toEqual(['by', 'pl'])
  })

  it('собственный serverCredited варианта и битый вариант не учитываются', () => {
    const plDoor: AdventDoor = { ...door, task: { ...door.task, serverCredited: undefined } }
    const flagged: AdventDoor = {
      ...plDoor,
      variants: [{ region: 'by', gift: { title: 'Брест', text: 'by' }, task: { type: 'route', text: 'by', ctaRoute: '/quests', serverCredited: 'yes' as never } }],
    }
    expect(resolveAdventDoor(flagged, 'by').task).not.toHaveProperty('serverCredited')
    const broken = { ...plDoor, variants: [{ region: 'by', task: { type: 'open', text: 'x' } }] } as unknown as AdventDoor
    expect(resolveAdventDoor(broken, 'by')).toBe(broken)
    expect(adventDoorRegions(broken)).toEqual([])
  })

  it('регион по умолчанию — из языка интерфейса', () => {
    expect(defaultAdventRegion('pl')).toBe('pl')
    expect(defaultAdventRegion('ru')).toBe('by')
    expect(defaultAdventRegion('en')).toBe('by')
  })

  it('перевод накладывается на варианты и тексты игр, ответы остаются из RU', () => {
    const config: AdventCampaignConfig = {
      year: 2026,
      start: '2026-12-01',
      end: '2027-01-07',
      doors: [
        door,
        { ...door, day: 2, region: undefined, variants: undefined, task: { type: 'open', text: 'pick', game: pick } },
      ],
    }
    const translated = applyAdventOverlay(config, {
      locale: 'en',
      year: 2026,
      doors: {
        '1': { variants: { by: { gift: { title: 'Brest', text: 'by-en' } } } },
        '2': { task: { game: { items: [{ label: 'Thermos' }, { label: 'Flip-flops', hint: 'not for snow' }] } } },
      },
    })
    expect(translated.doors[0]?.variants?.[0]?.gift.title).toBe('Brest')
    const game = translated.doors[1]?.task.game as AdventPickGame
    expect(game.items[0]).toEqual({ label: 'Thermos', correct: true })
    expect(game.items[1]).toEqual({ label: 'Flip-flops', correct: false, hint: 'not for snow' })
    expect(game.items[2]?.label).toBe('Фонарик')
  })
})

describe('компоненты игр', () => {
  it('тест даёт звание при любом числе отметок и засчитывает дверцу', async () => {
    const onComplete = jest.fn()
    const screen = await render(<AdventSelfcheckTask game={selfcheck} onComplete={onComplete} onOpenLink={jest.fn()} share={SHARE} />)
    await fireEvent.press(screen.getByTestId('advent-selfcheck-submit'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('advent-title-medal-title').props.children).toBe('В начале пути')
  })

  it('тест: звание и ссылка по числу отметок', async () => {
    const onOpenLink = jest.fn()
    const screen = await render(<AdventSelfcheckTask game={selfcheck} onComplete={jest.fn()} onOpenLink={onOpenLink} share={SHARE} />)
    for (let index = 0; index < 6; index += 1) await fireEvent.press(screen.getByTestId(`advent-selfcheck-item-${index}`))
    await fireEvent.press(screen.getByTestId('advent-selfcheck-submit'))
    expect(screen.getByTestId('advent-title-medal-title').props.children).toBe('Легенда')
    await fireEvent.press(screen.getByTestId('advent-selfcheck-link'))
    expect(onOpenLink).toHaveBeenCalledWith('/export')
  })

  it('пары: промах мягкий и не засчитывает, все пары — зачёт', async () => {
    const onComplete = jest.fn()
    const screen = await render(<AdventMatchTask game={match} onComplete={onComplete} />)
    await fireEvent.press(screen.getByTestId('advent-match-left-0'))
    await fireEvent.press(screen.getByTestId('advent-match-right-1'))
    expect(screen.getByTestId('advent-match-miss')).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()
    for (const index of [0, 1, 2]) {
      await fireEvent.press(screen.getByTestId(`advent-match-left-${index}`))
      await fireEvent.press(screen.getByTestId(`advent-match-right-${index}`))
    }
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('advent-match-celebration')).toBeTruthy()
  })

  it('рюкзак: лишняя вещь получает пояснение, верный набор — зачёт', async () => {
    const onComplete = jest.fn()
    const screen = await render(<AdventPickTask game={pick} onComplete={onComplete} />)
    await fireEvent.press(screen.getByTestId('advent-pick-item-0'))
    await fireEvent.press(screen.getByTestId('advent-pick-item-1'))
    await fireEvent.press(screen.getByTestId('advent-pick-check'))
    expect(screen.getByTestId('advent-pick-feedback')).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('advent-pick-item-1'))
    await fireEvent.press(screen.getByTestId('advent-pick-item-2'))
    await fireEvent.press(screen.getByTestId('advent-pick-check'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('advent-pick-celebration')).toBeTruthy()
  })
})

describe('лист дверцы с вариантами', () => {
  const variantDoor: AdventDoorView = {
    day: 2,
    date: '2026-12-02',
    kind: 'content',
    state: 'opened',
    region: 'by',
    gift: { title: 'Брест', text: 'by' },
    task: { type: 'open', text: 'by task', game: pick },
    reward: { xp: 10 },
    variants: [{ region: 'pl', gift: { title: 'Торунь', text: 'pl' }, task: { type: 'open', text: 'pl task', game: pick } }],
  }

  function Harness() {
    const [view, setView] = useState<AdventDoorView>(variantDoor)
    return (
      <AdventDoorSheet
        door={view}
        isAuthenticated
        campaignYear={2026}
        onClose={jest.fn()}
        onCompleteTask={() => setView((current) => ({ ...current, state: 'done', doneAt: '2026-12-02' }))}
      />
    )
  }

  it('решённая дверца не показывает пустую игру после смены региона и возврата', async () => {
    useAdventRegionStore.setState({ region: 'by' })
    const screen = await render(<Harness />)
    await fireEvent.press(screen.getByTestId('advent-pick-item-0'))
    await fireEvent.press(screen.getByTestId('advent-pick-item-2'))
    await fireEvent.press(screen.getByTestId('advent-pick-check'))
    expect(screen.getByTestId('advent-pick-celebration')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('advent-region-pl'))
    expect(screen.getByText('Торунь')).toBeTruthy()
    expect(screen.queryByTestId('advent-pick')).toBeNull()
    expect(screen.getByTestId('advent-task-done')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('advent-region-by'))
    expect(screen.queryByTestId('advent-pick')).toBeNull()
    expect(screen.getByTestId('advent-task-done')).toBeTruthy()
  })
})

describe('рождественское гадание (дверца 25)', () => {
  const fortune: AdventFortuneGame = { kind: 'fortune', items: Array.from({ length: 30 }, (_, index) => `Предсказание ${index + 1}`) }

  it('номер предсказания стабилен для человека и разный у разных людей', () => {
    expect(adventFortuneIndex('u1:2026:25', 30)).toBe(adventFortuneIndex('u1:2026:25', 30))
    const spread = new Set(Array.from({ length: 200 }, (_, index) => adventFortuneIndex(`u${index}:2026:25`, 30)))
    expect(spread.size).toBeGreaterThan(20)
    for (let index = 0; index < 50; index += 1) {
      const value = adventFortuneIndex(`seed-${index}`, 30)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(30)
    }
  })

  it('карточку тянут один раз: предсказание видно, дверца засчитана', async () => {
    const onComplete = jest.fn()
    const screen = await render(<AdventFortuneTask game={fortune} seed="2026:25" onComplete={onComplete} share={SHARE} />)
    expect(screen.queryByTestId('advent-fortune-text')).toBeNull()
    await fireEvent.press(screen.getByTestId('advent-fortune-draw'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(fortune.items).toContain(screen.getByTestId('advent-fortune-text').props.children)
    expect(screen.queryByTestId('advent-fortune-draw')).toBeNull()
  })

  it('гадание с запасным open не засчитывается открытием', () => {
    expect(adventTaskCreditsOnOpen({ type: 'open', text: 't', game: fortune })).toBe(false)
    expect(adventTaskGame({ type: 'open', text: 't', game: { kind: 'fortune', items: [] } })).toBeNull()
  })
})
