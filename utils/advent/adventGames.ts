// Чистая логика игр дверцы адвента (#3487): звание теста, проверка рюкзака,
// порядок карточек в «парах». Компоненты только рисуют результат.
import type { AdventGame, AdventPickItem, AdventSelfcheckGame, AdventSelfcheckTier, AdventTask } from '@/types/advent'

/** Звание по числу отметок: наибольший порог, который не выше `count`. */
export function adventSelfcheckTier(game: AdventSelfcheckGame, count: number): AdventSelfcheckTier | null {
  const sorted = [...game.tiers].sort((a, b) => a.min - b.min)
  let tier: AdventSelfcheckTier | null = sorted[0] ?? null
  for (const candidate of sorted) {
    if (count >= candidate.min) tier = candidate
  }
  return tier
}

export type AdventPickVerdict = {
  solved: boolean
  /** Сколько нужных вещей ещё не выбрано. */
  missing: number
  /** Выбранные лишние вещи — по индексу. */
  extra: number[]
}

/** Рюкзак собран, когда выбраны все нужные вещи и ни одной лишней. */
export function adventPickVerdict(items: AdventPickItem[], selected: ReadonlySet<number>): AdventPickVerdict {
  let missing = 0
  const extra: number[] = []
  items.forEach((item, index) => {
    if (item.correct && !selected.has(index)) missing += 1
    if (!item.correct && selected.has(index)) extra.push(index)
  })
  return { solved: missing === 0 && extra.length === 0, missing, extra }
}

/**
 * Порядок правой колонки «пар»: детерминированная перестановка вида
 * `(i·m + s) mod n`, в которой ни одна карточка не стоит напротив своей пары.
 * Одинакова на сервере, клиенте и в тестах — без Math.random.
 */
export function adventMatchOrder(count: number): number[] {
  const identity = Array.from({ length: count }, (_, index) => index)
  if (count < 2) return identity
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  for (const multiplier of [5, 3, 7, 2, 1]) {
    if (gcd(multiplier, count) !== 1) continue
    for (let shift = 1; shift < count; shift += 1) {
      const order = identity.map((index) => (index * multiplier + shift) % count)
      if (order.every((value, index) => value !== index)) return order
    }
  }
  return identity.map((index) => (index + 1) % count)
}

/** Виды игр, которые умеет рисовать этот клиент (#3487). */
export const ADVENT_SUPPORTED_GAMES: ReadonlySet<AdventGame['kind']> = new Set(['selfcheck', 'match', 'pick', 'wishlist', 'fortune'])

const nonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0

/**
 * Форма игры, без которой компонент упал бы на `.map`/`.length`. Серверный конфиг
 * проверяется лишь по минимуму (`isValidAdventCampaign`), поэтому битая игра
 * известного вида ведёт себя как неизвестная: задание идёт по `type`.
 */
const isRenderableGame = (game: AdventGame): boolean => {
  switch (game.kind) {
    case 'selfcheck':
      return nonEmptyArray(game.items) && nonEmptyArray(game.tiers)
    case 'match':
      return nonEmptyArray(game.pairs)
    case 'pick':
      return nonEmptyArray(game.items)
    case 'wishlist':
      return nonEmptyArray(game.places) && Number.isInteger(game.goal) && game.goal > 0
    case 'fortune':
      return nonEmptyArray(game.items)
    default:
      return false
  }
}

/** Игра задания, если клиент её знает; иначе задание идёт по `type`, как в старых сборках. */
export const adventTaskGame = (task: AdventTask): AdventGame | null =>
  task.game && ADVENT_SUPPORTED_GAMES.has(task.game.kind) && isRenderableGame(task.game) ? task.game : null

/**
 * Засчитывается ли задание самим открытием дверцы. `open` с игрой — нет:
 * `open` там лишь запасной путь для сборок, которые игру не знают.
 */
export const adventTaskCreditsOnOpen = (task: AdventTask): boolean => task.type === 'open' && !adventTaskGame(task)

/**
 * Номер предсказания гадания (#3487): FNV-1a от «аккаунт:год:день». Одно и то же
 * у человека на любом устройстве и при повторном открытии; у разных людей — разное.
 */
export function adventFortuneIndex(seed: string, count: number): number {
  if (count <= 0) return 0
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % count
}
