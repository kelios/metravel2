/**
 * Контракт конфига адвент-календаря (#2862). Тот же JSON позже отдаст
 * `GET /api/advent/campaigns/current/` — поля не переименовывать без бэка.
 */

export type AdventDoorKind =
  | 'content'
  | 'site-action'
  | 'riddle'
  | 'geo'
  | 'creative'
  | 'social'
  | 'planning'

/**
 * `open` — задание засчитывается самим открытием дверцы;
 * `route` — переход на действие сайта (`ctaRoute`) и ручная отметка «Сделано» (этап A);
 * `riddle` — ответ в поле, проверка чекером квестов, автозачёт;
 * `geo` — клик по карте в радиусе цели, автозачёт.
 */
export type AdventTaskType = 'open' | 'route' | 'riddle' | 'geo'

export interface AdventGift {
  title: string
  text: string
  /** Абсолютный URL картинки подарка (CDN) — опционально. */
  image?: string
  /** Внутренний маршрут сайта или внешний https-URL. */
  link?: string
  linkLabel?: string
}

/** `answer_pattern` в формате квестов (`utils/questAdapters.ts` → `buildAnswerChecker`). */
export interface AdventAnswerPattern {
  type: 'exact' | 'exact_any'
  value: string | string[]
}

export interface AdventRiddleQuestion {
  question: string
  hint?: string
  /** Варианты ответа для викторины; у свободной загадки отсутствуют. */
  options?: string[]
  answer_pattern: AdventAnswerPattern
}

export interface AdventGeoTarget {
  lat: number
  lng: number
  radiusMeters: number
  /** Центр и зум карты при открытии; по умолчанию — Беларусь целиком. */
  mapCenter?: { lat: number; lng: number }
  mapZoom?: number
}

export interface AdventTask {
  type: AdventTaskType
  text: string
  /** Внутренний маршрут действия; к нему добавляется `?from=advent&day=N`. */
  ctaRoute?: string
  ctaLabel?: string
  riddle?: { questions: AdventRiddleQuestion[] }
  geo?: AdventGeoTarget
}

export interface AdventReward {
  xp: number
  /** Слаг значка достижений (поезд B, #2867); на этапе A только показывается. */
  badgeSlug?: string
  label?: string
}

export interface AdventDoor {
  /** Порядковый номер 1…27 (1…24 основные, 25…27 бонусные). */
  day: number
  /** Календарная дата открытия `YYYY-MM-DD` по местному времени клиента. */
  date: string
  bonus?: boolean
  /** Секретная дверца не показывает содержимое до своего дня. */
  secret?: boolean
  kind: AdventDoorKind
  gift: AdventGift
  task: AdventTask
  reward: AdventReward
}

export interface AdventCampaignConfig {
  year: number
  /** Первый и последний день кампании включительно, `YYYY-MM-DD`. */
  start: string
  end: string
  doors: AdventDoor[]
}

export type AdventDoorState = 'locked' | 'available' | 'opened' | 'done'

/** Форма прогресса совпадает с будущим `GET/POST /api/advent/progress/`. */
export interface AdventProgressSnapshot {
  /** день → ISO-дата открытия */
  opened: Record<string, string>
  /** день → ISO-дата зачёта задания */
  tasksDone: Record<string, string>
  streak: number
}

/**
 * Переводы контента дверцы (#2883): только текстовые поля поверх RU-источника.
 * Даты, ссылки, `answer_pattern`, гео и награды в XP живут в RU-конфиге.
 */
export interface AdventRiddleQuestionOverlay {
  question?: string
  hint?: string
  /** Тот же порядок и число вариантов, что в RU; иначе варианты остаются RU. */
  options?: string[]
}

export interface AdventDoorOverlay {
  gift?: { title?: string; text?: string; linkLabel?: string }
  task?: { text?: string; ctaLabel?: string; riddle?: { questions: AdventRiddleQuestionOverlay[] } }
  reward?: { label?: string }
}

export interface AdventCampaignOverlay {
  locale: string
  year: number
  /** Ключ — `day` дверцы в виде строки. */
  doors: Record<string, AdventDoorOverlay>
}
