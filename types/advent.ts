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
 * `route` — переход на действие сайта (`ctaRoute`) и ручная отметка «Сделано»
 *   (у `serverCredited` отметку ставит сервер);
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

/**
 * Интерактивная механика задания (#3487): аддитивное поле поверх `type`.
 * Клиент, который её знает, рисует игру и засчитывает дверцу по её итогу;
 * старый клиент её не видит и ведёт задание по `type` (обычно `open`), поэтому
 * игра не ломает выпущенные сборки приложения.
 */
export type AdventGameKind = 'selfcheck' | 'match' | 'pick' | 'wishlist' | 'fortune'

/** Звание теста-самопроверки: выдаётся при числе отметок не меньше `min`. */
export interface AdventSelfcheckTier {
  min: number
  title: string
  text: string
  link?: string
  linkLabel?: string
}

/** «Со мной такое было»: человек отмечает карточки и получает звание. Засчитывается при любом итоге. */
export interface AdventSelfcheckGame {
  kind: 'selfcheck'
  items: string[]
  tiers: AdventSelfcheckTier[]
}

export interface AdventMatchPair {
  left: string
  right: string
  /** Короткий факт, который показывается после верной пары. */
  fact?: string
}

/** Игра «пары»: соединить левую карточку с правой. Засчитывается, когда собраны все пары. */
export interface AdventMatchGame {
  kind: 'match'
  pairs: AdventMatchPair[]
}

export interface AdventPickItem {
  label: string
  correct: boolean
  /** Мягкое пояснение, почему вещь лишняя или нужная. */
  hint?: string
}

/** «Выбери нужное»: собрать все верные предметы без лишних. */
export interface AdventPickGame {
  kind: 'pick'
  items: AdventPickItem[]
}

export interface AdventWishlistPlace {
  travelId: number
  title: string
  /** Внутренний маршрут статьи. */
  link: string
  image?: string
  country?: string
}

/**
 * Вишлист: «Был здесь» и «Хочу поехать» ставятся прямо в окне. Зачёт — серверный
 * (`credit_rule` travel_status/wishlist), `goal` — сколько мест нужно для него.
 */
export interface AdventWishlistGame {
  kind: 'wishlist'
  places: AdventWishlistPlace[]
  goal: number
}

/**
 * Рождественское гадание: колода добрых предсказаний. Карточка своя у каждого
 * аккаунта и не меняется при повторном открытии. Засчитывается, когда вытянута.
 */
export interface AdventFortuneGame {
  kind: 'fortune'
  items: string[]
}

export type AdventGame = AdventSelfcheckGame | AdventMatchGame | AdventPickGame | AdventWishlistGame | AdventFortuneGame

export interface AdventTask {
  type: AdventTaskType
  text: string
  /** Внутренний маршрут действия; к нему добавляется `?from=advent&day=N`. */
  ctaRoute?: string
  ctaLabel?: string
  /**
   * Задание засчитывает сервер по самому действию на сайте (статус поездки,
   * подписка, оценка, peer-значок, шаг квеста; #2940): кнопки «Сделано» нет,
   * ручная отметка таких дверец серверу не уходит — он её всё равно отбросит.
   */
  serverCredited?: boolean
  riddle?: { questions: AdventRiddleQuestion[] }
  geo?: AdventGeoTarget
  game?: AdventGame
}

export interface AdventReward {
  xp: number
  /** Слаг значка достижений (поезд B, #2867); на этапе A только показывается. */
  badgeSlug?: string
  label?: string
}

/** Региональный вариант дверцы (#3486): «Беларусь» или «Польша». */
export type AdventRegion = 'by' | 'pl'

/**
 * Второй подарок и задание той же дверцы. Прогресс, серия и награда общие:
 * дверца засчитывается любым вариантом. Старый клиент вариант не видит.
 */
export interface AdventDoorVariant {
  region: AdventRegion
  gift: AdventGift
  task: AdventTask
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
  /** Регион основного подарка и задания; задаётся вместе с `variants`. */
  region?: AdventRegion
  variants?: AdventDoorVariant[]
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

/** Перевод текстов игры: те же длина и порядок, что в RU; ответы и флаги — в RU-конфиге. */
export interface AdventGameOverlay {
  items?: Array<string | { label?: string; hint?: string }>
  tiers?: Array<{ title?: string; text?: string; linkLabel?: string }>
  pairs?: Array<{ left?: string; right?: string; fact?: string }>
  places?: Array<{ title?: string }>
}

export interface AdventGiftOverlay {
  title?: string
  text?: string
  linkLabel?: string
}

export interface AdventTaskOverlay {
  text?: string
  ctaLabel?: string
  riddle?: { questions: AdventRiddleQuestionOverlay[] }
  game?: AdventGameOverlay
}

export interface AdventDoorOverlay {
  gift?: AdventGiftOverlay
  task?: AdventTaskOverlay
  reward?: { label?: string }
  /** Переводы вариантов по региону. */
  variants?: Partial<Record<AdventRegion, { gift?: AdventGiftOverlay; task?: AdventTaskOverlay }>>
}

export interface AdventCampaignOverlay {
  locale: string
  year: number
  /** Ключ — `day` дверцы в виде строки. */
  doors: Record<string, AdventDoorOverlay>
}
