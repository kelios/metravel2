import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { MAX_ANSWER_CHARS, OFFTOPIC_REPLY_RU, buildSystemPrompt, buildUserMessage, formatSourcesBlock } from '@/api/aiAssist/prompt'
import type { AiSource } from '@/api/aiAssist/types'
import { aiAssistStaticResources as be } from '@/i18n/locales/be/static/ai_assist_static'
import { aiAssistStaticResources as en } from '@/i18n/locales/en/static/ai_assist_static'
import { aiAssistStaticResources as pl } from '@/i18n/locales/pl/static/ai_assist_static'
import { aiAssistStaticResources as ru } from '@/i18n/locales/ru/static/ai_assist_static'
import { aiAssistStaticResources as uk } from '@/i18n/locales/uk/static/ai_assist_static'

// #2712: наборы rag_answers/offtopic учат модель ровно на том промпте, что собирает экран.
// Слепок `scripts/ai-train/assistant_prompt.json` читают сборщики наборов (Python);
// после правки prompt.ts или фразы отказа: UPDATE_ASSISTANT_PROMPT=1 npx jest <этот файл>.

const FIXTURE = path.resolve(process.cwd(), 'scripts/ai-train/assistant_prompt.json')
const LOCALES = { ru, be, uk, pl, en }

const SAMPLE: AiSource[] = [
  { type: 'travel', source_id: '568', title: 'Краков:\nпутеводитель «по местам»', url: 'https://metravel.by/travels/krakow', path: '/travels/krakow', snippet: `Польша, Краков. ${'Вавель '.repeat(80)}`, score: 3 },
  { type: 'quest', source_id: 'krakow-dragon', title: 'Квест по Кракову: Вавельский дракон', url: 'https://metravel.by/quests/krakow/krakow-dragon', path: '/quests/krakow/krakow-dragon', snippet: '', score: 1 },
]

const expected = () => {
  const block = formatSourcesBlock(SAMPLE)
  return {
    system: Object.fromEntries(Object.keys(LOCALES).map((locale) => [locale, buildSystemPrompt(locale)])),
    offtopic_reply: Object.fromEntries(Object.entries(LOCALES).map(([locale, strings]) => [locale, strings['ask.offTopic']])),
    max_answer_chars: MAX_ANSWER_CHARS,
    user_no_sources: buildUserMessage('{question}', []),
    user_with_sources: buildUserMessage('{question}', SAMPLE).replace(block, '{sources}'),
  }
}

describe('assistant prompt fixture for the training sets (#2712)', () => {
  it('scripts/ai-train/assistant_prompt.json совпадает с prompt.ts и фразами отказа', () => {
    const current = expected()
    if (process.env.UPDATE_ASSISTANT_PROMPT === '1') fs.writeFileSync(FIXTURE, `${JSON.stringify(current, null, 2)}\n`)
    expect(JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))).toEqual(current)
    expect(current.offtopic_reply.ru).toBe(OFFTOPIC_REPLY_RU)
  })

  it('срезы eval.py режима ассистента идут с текущим системным промптом экрана (#2731)', () => {
    for (const name of ['rag_answers', 'offtopic']) {
      const file = path.resolve(process.cwd(), `scripts/ai-train/eval_prompts/${name}.jsonl`)
      const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
      for (const row of rows) expect([name, row.id, row.system]).toEqual([name, row.id, buildSystemPrompt(row.lang)])
    }
  })

  it('Python-сборщик форматирует карточки байт в байт как formatSourcesBlock', () => {
    const script = [
      'import json, sys',
      "sys.path.insert(0, 'scripts/ai-train')",
      'from sets.assistant_prompt import build_user_message',
      'sources = json.load(sys.stdin)',
      "print(json.dumps([build_user_message('Что посмотреть?', sources, 'ru'), build_user_message('Исландия', [], 'ru')], ensure_ascii=False))",
    ].join('\n')
    const run = spawnSync('python3', ['-I', '-c', script], { cwd: process.cwd(), input: JSON.stringify(SAMPLE), encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(JSON.parse(run.stdout)).toEqual([buildUserMessage('Что посмотреть?', SAMPLE), buildUserMessage('Исландия', [])])
  })
})
