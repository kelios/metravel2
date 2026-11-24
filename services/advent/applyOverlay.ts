import type {
  AdventCampaignConfig,
  AdventCampaignOverlay,
  AdventDoor,
  AdventDoorOverlay,
  AdventGame,
  AdventGameOverlay,
  AdventGift,
  AdventGiftOverlay,
  AdventRiddleQuestion,
  AdventRiddleQuestionOverlay,
  AdventTask,
  AdventTaskOverlay,
} from '@/types/advent'

const text = (candidate: string | undefined, fallback: string): string =>
  typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : fallback

const optionalText = (candidate: string | undefined, fallback: string | undefined): string | undefined =>
  fallback === undefined ? undefined : text(candidate, fallback)

const applyQuestion = (question: AdventRiddleQuestion, patch: AdventRiddleQuestionOverlay | undefined): AdventRiddleQuestion => {
  if (!patch) return question
  const options =
    question.options && patch.options && patch.options.length === question.options.length && patch.options.every((o) => text(o, '') !== '')
      ? patch.options
      : question.options
  return { ...question, question: text(patch.question, question.question), hint: optionalText(patch.hint, question.hint), options }
}

/** Перевод игры: тексты по индексу; ответы, флаги и ссылки остаются из RU (#3487). */
const applyGame = (game: AdventGame, patch: AdventGameOverlay | undefined): AdventGame => {
  if (!patch) return game
  switch (game.kind) {
    case 'selfcheck':
      return {
        ...game,
        items: game.items.map((item, index) => {
          const translated = patch.items?.[index]
          return text(typeof translated === 'string' ? translated : undefined, item)
        }),
        tiers: game.tiers.map((tier, index) => {
          const translated = patch.tiers?.[index]
          return {
            ...tier,
            title: text(translated?.title, tier.title),
            text: text(translated?.text, tier.text),
            linkLabel: optionalText(translated?.linkLabel, tier.linkLabel),
          }
        }),
      }
    case 'match':
      return {
        ...game,
        pairs: game.pairs.map((pair, index) => {
          const translated = patch.pairs?.[index]
          return {
            ...pair,
            left: text(translated?.left, pair.left),
            right: text(translated?.right, pair.right),
            fact: optionalText(translated?.fact, pair.fact),
          }
        }),
      }
    case 'pick':
      return {
        ...game,
        items: game.items.map((item, index) => {
          const translated = patch.items?.[index]
          const entry = typeof translated === 'object' && translated ? translated : undefined
          return { ...item, label: text(entry?.label, item.label), hint: optionalText(entry?.hint, item.hint) }
        }),
      }
    case 'fortune':
      return {
        ...game,
        items: game.items.map((item, index) => {
          const translated = patch.items?.[index]
          return text(typeof translated === 'string' ? translated : undefined, item)
        }),
      }
    case 'wishlist':
      return {
        ...game,
        places: game.places.map((place, index) => ({ ...place, title: text(patch.places?.[index]?.title, place.title) })),
      }
    default:
      return game
  }
}

const applyGift = (gift: AdventGift, patch: AdventGiftOverlay | undefined): AdventGift => ({
  ...gift,
  title: text(patch?.title, gift.title),
  text: text(patch?.text, gift.text),
  linkLabel: optionalText(patch?.linkLabel, gift.linkLabel),
})

const applyTask = (task: AdventTask, patch: AdventTaskOverlay | undefined): AdventTask => ({
  ...task,
  text: text(patch?.text, task.text),
  ctaLabel: optionalText(patch?.ctaLabel, task.ctaLabel),
  riddle: task.riddle
    ? { ...task.riddle, questions: task.riddle.questions.map((question, index) => applyQuestion(question, patch?.riddle?.questions?.[index])) }
    : task.riddle,
  game: task.game ? applyGame(task.game, patch?.game) : task.game,
})

const applyDoor = (door: AdventDoor, patch: AdventDoorOverlay | undefined): AdventDoor => {
  if (!patch) return door
  return {
    ...door,
    gift: applyGift(door.gift, patch.gift),
    task: applyTask(door.task, patch.task),
    reward: { ...door.reward, label: optionalText(patch.reward?.label, door.reward.label) },
    variants: door.variants?.map((variant) => {
      const translated = patch.variants?.[variant.region]
      return { ...variant, gift: applyGift(variant.gift, translated?.gift), task: applyTask(variant.task, translated?.task) }
    }),
  }
}

/**
 * Накладывает переводы на RU-конфиг (#2883). Пустая или отсутствующая строка
 * перевода оставляет RU-текст; без overlay возвращает тот же объект конфига.
 */
export function applyAdventOverlay(
  config: AdventCampaignConfig,
  overlay: AdventCampaignOverlay | null | undefined,
): AdventCampaignConfig {
  if (!overlay || overlay.year !== config.year) return config
  return { ...config, doors: config.doors.map((door) => applyDoor(door, overlay.doors[String(door.day)])) }
}
