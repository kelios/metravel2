/**
 * #3354: личные вопросы в контуре оценки — отдельный набор `cases.personal.jsonl`, который задаётся службе от
 * имени тестового аккаунта. Токен берётся из окружения прогона и не попадает ни в наблюдение хода, ни в ошибки.
 */
import fs from 'fs'
import path from 'path'

import { createAskClient } from '@/api/aiAssist/askProvider'

import { createAskSession } from '../../../scripts/ai-assistant-eval/ask-path.mjs'
import { loadCases, PROFILE_TOKEN_ENV, profileTokenFor } from '../../../scripts/ai-assistant-eval/run-core.mjs'
import { makeTempDir } from '../cli-test-utils'

const TOKEN = 'test-token-visitor-a-0001'
const PERSONAL = path.join(process.cwd(), 'scripts/ai-assistant-eval/cases.personal.jsonl')

type Case = { id: string; group: string; lang: string; profile?: boolean; turns: string[]; expects: string[]; expect_sources?: { pattern: string; min?: number } }

describe('контур оценки: личные вопросы (#3354)', () => {
  it('набор: не меньше десяти личных вопросов на пяти языках, у каждого — ожидание по источникам', () => {
    const cases = loadCases(PERSONAL) as Case[]
    const personal = cases.filter((item) => item.group === 'personal')
    expect(personal.length).toBeGreaterThanOrEqual(10)
    expect([...new Set(personal.map((item) => item.lang))].sort()).toEqual(['be', 'en', 'pl', 'ru', 'uk'])
    expect(personal.every((item) => item.profile === true && item.expects[0] === 'answer' && Boolean(item.expect_sources?.pattern))).toBe(true)
    // Контроль: тот же вопрос о своём без токена — вопрос гостя, а просьба о рекомендации с токеном — обычный подбор.
    const control = cases.filter((item) => item.group === 'personal_control')
    expect(control.some((item) => item.profile !== true && item.turns[0] === personal[0].turns[0])).toBe(true)
    expect(control.some((item) => item.profile === true)).toBe(true)
  })

  it('личные вопросы не входят в набор приёмки модели: её числа от аккаунта не зависят', () => {
    const live = loadCases(path.join(process.cwd(), 'scripts/ai-assistant-eval/cases.live.jsonl')) as Case[]
    expect(live.filter((item) => item.profile !== undefined || item.group.startsWith('personal'))).toEqual([])
    const thresholds = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts/ai-assistant-eval/acceptance.thresholds.json'), 'utf8')) as { runs: Record<string, { cases: string }> }
    expect(Object.values(thresholds.runs).map((run) => run.cases)).not.toContain('cases.personal.jsonl')
  })

  it('токен берётся из окружения только для личного вопроса; без него личный вопрос — ошибка сборки прогона', () => {
    const personal = { id: 'pv01', profile: true }
    expect(profileTokenFor(personal, { [PROFILE_TOKEN_ENV]: ` ${TOKEN} ` })).toBe(TOKEN)
    expect(profileTokenFor({ id: 'lv01' }, { [PROFILE_TOKEN_ENV]: TOKEN })).toBeNull()
    expect(profileTokenFor({ id: 'pv14', profile: false }, { [PROFILE_TOKEN_ENV]: TOKEN })).toBeNull()
    expect(() => profileTokenFor(personal, {})).toThrow(new RegExp(`pv01.*${PROFILE_TOKEN_ENV}`))
    // Сообщение об ошибке значения переменной не несёт.
    try {
      profileTokenFor(personal, { [PROFILE_TOKEN_ENV]: '   ' })
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(TOKEN)
    }
  })

  it('путь службы: токен уходит заголовком Authorization, а в наблюдение хода не попадает', async () => {
    const seen: Array<Record<string, string>> = []
    const body = [`event: sources\ndata: ${JSON.stringify({ sources: [], degraded: false, remaining: 19 })}`, 'event: done\ndata: {"status":"no_sources","profile":true}', ''].join('\n\n')
    const session = (authToken: string | null) =>
      createAskSession({
        createAskClient,
        askUrl: 'http://service.test',
        visitor: '2001:db8::a',
        locale: 'ru',
        authToken,
        fetchImpl: async (_url: string, init: { headers: Record<string, string> }) => {
          seen.push(init.headers)
          return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, text: async () => body }
        },
      })
    const personal = await session(TOKEN)('Куда мне поехать из того, что я сохранила?')
    const guest = await session(null)('Куда мне поехать из того, что я сохранила?')
    expect(seen[0]).toMatchObject({ Authorization: `Token ${TOKEN}`, 'X-Real-IP': '2001:db8::a' })
    expect(seen[1]).not.toHaveProperty('Authorization')
    expect(JSON.stringify(personal)).not.toContain(TOKEN)
    expect(JSON.stringify(personal)).not.toMatch(/authorization/i)
    expect(personal.status).toBe('no_sources')
    expect(guest.status).toBe('no_sources')
  })

  it('кривой признак личного вопроса в наборе — ошибка загрузки', () => {
    const file = path.join(makeTempDir('ai-eval-personal-'), 'cases.jsonl')
    const write = (profile: unknown) => fs.writeFileSync(file, `${JSON.stringify({ id: 'p1', group: 'personal', lang: 'ru', q: 'Мои планы', expect: 'answer', profile })}\n`)
    write(true)
    expect(loadCases(file)).toHaveLength(1)
    for (const broken of ['yes', 1, { token: 'x' }]) {
      write(broken)
      expect(() => loadCases(file)).toThrow(/profile/)
    }
  })
})
