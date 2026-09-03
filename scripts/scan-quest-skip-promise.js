#!/usr/bin/env node
/**
 * Скан ложного обещания «нажми Пропустить» — текст шага не имеет права звать
 * игрока нажать ссылку «Пропустить», если у шага есть проверяемый ответ.
 *
 * Почему это дефект, а не придирка. Ссылка «Пропустить» в мастере квеста
 * значит НЕ «этот вопрос можно не отвечать», а «отложить точку — иначе квест не
 * засчитается» (#1633, поведение сознательное). Поэтому задание, которое пишет
 * «Если ничего такого не осталось — просто нажми „Пропустить“», обещает
 * игроку выход, которого нет: он жмёт ссылку, доходит до конца и упирается в
 * незакрытый финал.
 *
 * Доказанный кейс #1720: `khotomlya-emerald-lakes / 1-pustoe` — обязательный
 * шаг с `exact_any` (лавка у тропы), гейтящий финал, и приглашение нажать
 * «Пропустить» прямо в задании. Автор при этом сама сомневалась, что лавка на
 * месте, то есть приглашение было единственным выходом — и оно не работало.
 *
 * Что скан ловит и чего НЕ ловит. Ловит обращение к КНОПКЕ: слово в кавычках
 * («Пропустить») или после глагола действия («нажми», «жми», «выбери»). НЕ
 * ловит — и не должен — обычное значение «не заметить»: «его не пропустишь»,
 * «чтобы не пропустить», «её легко пропустить». Эти три формы стоят в тексте
 * десятков шагов (409, 239, 1607, 203) и к кнопке отношения не имеют.
 *
 * Шаги со свободным ответом (`any`, `any_text`) в скан не входят: там ответ
 * принимается любой, и «пропустить» игроку в принципе не нужно.
 *
 *   node scripts/scan-quest-skip-promise.js                          # весь прод
 *   node scripts/scan-quest-skip-promise.js --quest-id=khotomlya-emerald-lakes
 *   node scripts/scan-quest-skip-promise.js --source=scripts/khotomlya-lakes-quest-data.js
 *   node scripts/scan-quest-skip-promise.js --json
 *
 * Exit code 1, если найдено хотя бы одно ложное обещание.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

/** Поля шага, которые игрок читает у карточки: задание, рассказ и подсказка. */
const SCANNED_FIELDS = ['task', 'story', 'hint']

/**
 * Свободные типы ответа. У них принимается любой непустой (или достаточно
 * длинный) ввод, поэтому обещание «можно пропустить» ничего не ломает: игрок
 * закрывает шаг тем, что видит.
 */
const FREE_TYPES = new Set(['any', 'any_text'])

/** Любая словоформа «пропустить»: пропусти, пропустить, пропустишь, пропущено. */
const SKIP_WORD_RE = /пропус[тщ][а-яё]*/giu

/**
 * Отрицание и «легко/сложно» перед словом — это значение «не заметить», а не
 * кнопка. Именно на этих формах держатся контрольные шаги 409 («его не
 * пропустишь»), 239 и 203 («чтобы не пропустить»), 1607 («её легко
 * пропустить»): скан обязан на них молчать, иначе он утонет в шуме и его
 * выключат.
 */
const NOT_A_BUTTON_RE = /(?:\bне|\bлегко|\bсложно|\bтрудно|\bнельзя|\bневозможно)\s+(?:было\s+)?$/iu

/**
 * Обращение к элементу интерфейса: глагол действия или прямое упоминание
 * кнопки/ссылки непосредственно перед словом. Окно в 40 знаков — чтобы
 * «просто нажми» и «нажми на ссылку» попадали, а глагол из соседнего
 * предложения — нет; поэтому окно обрывается на конце предложения.
 */
const BUTTON_ACTION_RE = /(?:нажм|жми|тапн|кликн|выбер|воспользуйся|использу|кнопк|ссылк)[^.!?]{0,40}$/iu

/** Кавычка прямо перед словом: «Пропустить» — это цитата подписи кнопки. */
const QUOTE_BEFORE_RE = /[«"„‚'‘]\s*$/u

/** Ложные обещания в одном поле шага. */
function findSkipPromises(text) {
  const source = String(text ?? '')
  if (!source) return []
  const hits = []
  for (const match of source.matchAll(SKIP_WORD_RE)) {
    const before = source.slice(Math.max(0, match.index - 60), match.index)
    if (NOT_A_BUTTON_RE.test(before)) continue
    const quoted = QUOTE_BEFORE_RE.test(before)
    const action = BUTTON_ACTION_RE.test(before)
    if (!quoted && !action) continue
    hits.push({
      match: match[0],
      via: quoted ? (action ? 'quote+action' : 'quote') : 'action',
      excerpt: source.slice(Math.max(0, match.index - 45), match.index + match[0].length + 15).trim(),
    })
  }
  return hits
}

function scanQuests(quests) {
  const findings = []
  let scannedSteps = 0
  for (const quest of quests) {
    for (const step of quest.steps || []) {
      if (step.is_intro) continue
      scannedSteps++
      const type = step.answer_pattern?.type ?? null
      if (!type || FREE_TYPES.has(type)) continue
      for (const field of SCANNED_FIELDS) {
        const hits = findSkipPromises(step[field])
        if (!hits.length) continue
        findings.push({
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          step_db_id: step.id ?? null,
          step_id: step.step_id,
          answer_type: type,
          field,
          hits,
        })
      }
    }
  }
  return { findings, scannedSteps }
}

// ===================== Источники данных =====================

function toScanBundle(bundle) {
  return { id: bundle.id, quest_id: bundle.quest_id, steps: parseSteps(bundle) }
}

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map(toScanBundle)
}

// ===================== CLI =====================

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    questId: get('quest-id') || null,
    source: get('source') || null,
    json: argv.includes('--json'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const quests = args.source
    ? loadLocalBundles(args.source, args.questId)
    : await loadFromApi(args.apiUrl, args.questId)

  const { findings, scannedSteps } = scanQuests(quests)
  const source = args.source || args.apiUrl

  if (args.json) {
    console.log(JSON.stringify({ source, quests: quests.length, scannedSteps, findings }, null, 2))
  } else {
    console.log(`Скан «Пропустить»: ${source} — ${quests.length} квестов, ${scannedSteps} шагов`)
    for (const f of findings) {
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    поле ${f.field} (${f.answer_type}) зовёт нажать «Пропустить»: ${f.hits.map((h) => h.excerpt).join(' | ')}`)
    }
    console.log(findings.length ? `\nЛожных обещаний: ${findings.length}` : '\nЛожных обещаний нет.')
  }

  if (findings.length) process.exitCode = 1
}

module.exports = {
  SCANNED_FIELDS,
  FREE_TYPES,
  findSkipPromises,
  scanQuests,
  toScanBundle,
  parseArgs,
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
