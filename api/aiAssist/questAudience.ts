/**
 * Аудитория квеста в карточке ассистента (#3276).
 *
 * Каталог помечает детские и семейные квесты тегами (`kids` у 26 квестов из 343, `family`,
 * `age-8-10`, `adult-required`), но карточка несла только город, число точек, длительность и
 * сложность, а слово «детский» стоит в названии у 9 из 26. На «Какой из них подойдёт детям?»
 * модель видела две карточки одного вида и выбирала наугад (mt03#1, замер 11.11.2026).
 *
 * Здесь одно правило для экрана (`questToSource`), службы `/ai/ask` (`scripts/ai-assist/app.ts`)
 * и слепка обучения (`quest_audience` и `quest_card(audience=True)` в
 * `scripts/ai-train/sets/rag_answers.py` — тест сверяет строки на одних тегах). Модуль без
 * `@/`-импортов и без CommonJS: службу грузит `node --experimental-strip-types` в образе с
 * `type=module`, куда из `utils/` попадают только перечисленные в Dockerfile файлы. Поэтому на
 * вход идут уже прочитанные слаги: экран читает теги каталога через `enabledQuestTags`
 * (`@/utils/questTags`), служба берёт `tags` фрагмента индекса — там это список слагов.
 */

export type QuestAudienceKind = 'kids' | 'family'

export type QuestAudience = {
  kind: QuestAudienceKind
  /** Возраст по тегам `age-<от>-<до>`; несколько тегов — общий диапазон. */
  age: readonly [number, number] | null
  /** Тег `adult-required`: квест проходят со взрослым. */
  adult: boolean
}

const AGE_TAG_RE = /^age-(\d+)-(\d+)$/

/** Аудитория по включённым тегам квеста; не детский и не семейный — `null`. */
export const questAudience = (slugs: readonly string[]): QuestAudience | null => {
  const kind: QuestAudienceKind | null = slugs.includes('kids') ? 'kids' : slugs.includes('family') ? 'family' : null
  if (!kind) return null
  const ages = slugs.map((tag) => AGE_TAG_RE.exec(tag)).filter((match): match is RegExpExecArray => match !== null)
  return {
    kind,
    age: ages.length ? [Math.min(...ages.map((match) => Number(match[1]))), Math.max(...ages.map((match) => Number(match[2])))] : null,
    adult: slugs.includes('adult-required'),
  }
}

const HEAD_RU: Record<QuestAudienceKind | 'any', string> = {
  kids: 'Детский городской квест',
  family: 'Семейный городской квест',
  any: 'Городской квест',
}

/**
 * Начало фрагмента карточки квеста: вид квеста с городом и страной, возраст, «Со взрослым» — по
 * аудитории (`questAudience` тегов каталога либо запись фактов индекса #3287). Слова русские, как весь
 * фрагмент: модель обучена на RU-карточках, ответ переводит сама.
 */
export const questAudienceLead = (audience: QuestAudience | null, city?: string | null, country?: string | null): string[] => {
  const cityName = String(city ?? '').trim()
  const countryName = String(country ?? '').trim()
  return [
    `${HEAD_RU[audience?.kind ?? 'any']}${cityName ? ` по городу ${cityName}` : ''}${countryName ? ` (${countryName})` : ''}`,
    audience?.age ? `Возраст: ${audience.age[0]}–${audience.age[1]} лет` : '',
    audience?.adult ? 'Со взрослым' : '',
  ].filter(Boolean)
}

// `\b` не знает кириллицы: начало слова — lookbehind по букве. «Дет» без окончания ловил бы
// «детали» и «детектив», поэтому формы перечислены.
const CHILDREN_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' +
    [
      // RU
      'дет(?:и|ей|ям|ьми|ях|к(?:и|ам|ами|ах)|ок|ишк\\p{L}+|ск\\p{L}+)', 'реб[её]н(?:ок|к\\p{L}+)', 'малыш\\p{L}*', 'школьник\\p{L}*', 'дошкольник\\p{L}*',
      // BE
      'дзец(?:і|ям|ьмі|ях)', 'дзяцей', 'дзіц\\p{L}+',
      // UK
      'діт(?:и|ей|ям|ьми|ях|к\\p{L}+|лах\\p{L}*)', 'дит(?:ин\\p{L}+|яч\\p{L}+)', 'малюк\\p{L}*',
      // PL
      'dzie(?:ci|ć|ck)\\p{L}*', 'maluch\\p{L}*',
      // EN
      'kids?', 'child(?:ren)?', 'toddlers?',
    ].join('|') +
    ')(?![\\p{L}])',
  'iu',
)

/** Вопрос о поездке или квесте с ребёнком — на RU/BE/UK/PL/EN. */
export const asksAboutChildren = (question: string): boolean => CHILDREN_RE.test(String(question ?? ''))
