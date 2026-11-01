import type {
  AdventCampaignConfig,
  AdventCampaignOverlay,
  AdventDoor,
  AdventDoorOverlay,
  AdventRiddleQuestion,
} from '@/types/advent'

const text = (candidate: string | undefined, fallback: string): string =>
  typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : fallback

const optionalText = (candidate: string | undefined, fallback: string | undefined): string | undefined =>
  fallback === undefined ? undefined : text(candidate, fallback)

const applyQuestion = (question: AdventRiddleQuestion, overlay: AdventDoorOverlay['task']): AdventRiddleQuestion[] => {
  const translated = overlay?.riddle?.questions
  return [question].map((item, index) => {
    const patch = translated?.[index]
    if (!patch) return item
    const options =
      item.options && patch.options && patch.options.length === item.options.length && patch.options.every((o) => text(o, '') !== '')
        ? patch.options
        : item.options
    return { ...item, question: text(patch.question, item.question), hint: optionalText(patch.hint, item.hint), options }
  })
}

const applyDoor = (door: AdventDoor, patch: AdventDoorOverlay | undefined): AdventDoor => {
  if (!patch) return door
  const questions = door.task.riddle?.questions.map((question, index) => {
    const translated = patch.task?.riddle?.questions?.[index]
    return applyQuestion(question, translated ? { riddle: { questions: [translated] } } : undefined)[0]
  })
  return {
    ...door,
    gift: {
      ...door.gift,
      title: text(patch.gift?.title, door.gift.title),
      text: text(patch.gift?.text, door.gift.text),
      linkLabel: optionalText(patch.gift?.linkLabel, door.gift.linkLabel),
    },
    task: {
      ...door.task,
      text: text(patch.task?.text, door.task.text),
      ctaLabel: optionalText(patch.task?.ctaLabel, door.task.ctaLabel),
      riddle: door.task.riddle && questions ? { ...door.task.riddle, questions } : door.task.riddle,
    },
    reward: { ...door.reward, label: optionalText(patch.reward?.label, door.reward.label) },
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
