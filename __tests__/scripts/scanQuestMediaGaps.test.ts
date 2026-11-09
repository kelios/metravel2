// #3186: скан медиа квестов — обложка, текст, видео и постер финала.
//
// Без этого скана квесты без видео финала копились партиями (25 в #2256, 49 в
// #3171, 50 в #3184), и никакой сигнал не срабатывал. Тест держит три вещи:
// пропуск даёт ненулевой исход, чистый каталог — нулевой, а сбой сети не
// превращается в «пропусков нет».
jest.mock('@/scripts/lib/fetchJson', () => ({ fetchJson: jest.fn() }))

const { fetchJson } = require('@/scripts/lib/fetchJson')
const { ExpectedFailureError, UsageError } = require('@/scripts/lib/cli-contract')
const {
  buildContext,
  main,
  nextSteps,
  parseArgs,
  questGaps,
  scanMediaGaps,
} = require('@/scripts/scan-quest-media-gaps')

const API = 'https://metravel.test'
const argv = (...flags: string[]) => ['node', 'scan-quest-media-gaps.js', `--api-url=${API}`, ...flags]

const complete = (questId: string, id = 1) => ({
  id,
  quest_id: questId,
  title: questId,
  cover_url: `${API}/quest-cover/quests/${id}/main/abc.webp`,
  finale: { text: 'Финал', video_url: `${API}/v/${id}.mp4`, poster_url: `${API}/p/${id}.webp` },
})

const ctx = buildContext({
  finaleQuests: [{ questId: 'mapped-quest', dir: 'mappedQuest', finaleId: 77 }],
  existingVideoQuests: [{ questId: 'old-quest', dir: 'oldDir', finaleId: 3 }],
  assetDirs: ['mappedQuest', 'withCover', 'withPrompt'],
  hasFile: (dir: string, name: string) =>
    (dir === 'withCover' && name === 'cover.png') || (dir === 'withPrompt' && name === 'PROMPT.md'),
})

/** Каталог из одной страницы + бандлы по quest_id. */
function mockProd(bundles: Array<Record<string, unknown>>) {
  ;(fetchJson as jest.Mock).mockImplementation(async (url: string) => {
    if (url === `${API}/api/quests/`) return { results: bundles.map((b) => ({ quest_id: b.quest_id })), next: null }
    const bundle = bundles.find((b) => url === `${API}/api/quests/by-quest-id/${b.quest_id}/`)
    if (!bundle) throw Object.assign(new Error(`404 ${url}`), { statusCode: 404 })
    return bundle
  })
}

beforeEach(() => {
  ;(fetchJson as jest.Mock).mockReset()
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('questGaps — что считается пропуском', () => {
  it('полный квест — без пропусков', () => {
    expect(questGaps(complete('a'))).toEqual([])
  })

  it('заглушка обложки, пустые видео и постер — три пропуска', () => {
    const bundle = {
      ...complete('a'),
      cover_url: `${API}/static/quests/quest-default-cover.svg`,
      finale: { text: 'Финал', video_url: null, poster_url: '' },
    }
    expect(questGaps(bundle)).toEqual(['cover', 'finale_video', 'finale_poster'])
  })

  it('пустая обложка и финал без текста тоже пропуски', () => {
    expect(questGaps({ ...complete('a'), cover_url: null, finale: { text: '  ', video_url: 'v', poster_url: 'p' } })).toEqual([
      'cover',
      'finale_text',
    ])
    expect(questGaps({ ...complete('a'), finale: null })).toEqual(['finale_text', 'finale_video', 'finale_poster'])
  })
})

describe('nextSteps — подсказка ведёт к команде', () => {
  it('квест в маппинге: генерация и dry-run заливки только этого quest_id', () => {
    const [step] = nextSteps('mapped-quest', ['finale_video', 'finale_poster'], ctx)
    expect(step).toContain('finaleId 77')
    expect(step).toContain('generate-quest-finale-videos.js --quest-id=mapped-quest')
    // без --quest-id заливка PATCH-ит финалы всех квестов QUESTS
    expect(step).toContain('upload-quest-finales.js --dry-run --quest-id=mapped-quest')
  })

  it('видео есть, нет только постера — заливка --posters-only, видео на проде не трогается', () => {
    const [step] = nextSteps('mapped-quest', ['finale_poster'], ctx)
    expect(step).toContain('upload-quest-finales.js --dry-run --posters-only --quest-id=mapped-quest')
  })

  it('старый квест с готовым видео: постер через --posters-existing, в QUESTS не добавлять', () => {
    const [poster] = nextSteps('old-quest', ['finale_poster'], ctx)
    expect(poster).toContain('--posters-existing --quest-id=old-quest')
    expect(poster).toContain('--posters-only --quest-id=old-quest')
    const [video] = nextSteps('old-quest', ['finale_video', 'finale_poster'], ctx)
    expect(video).toContain('в QUESTS не добавлять')
    expect(video).not.toContain('добавить запись')
  })

  it('квест вне маппинга: добавить запись со сверкой текста, а не гадать finaleId', () => {
    expect(nextSteps('new-quest', ['finale_video'], ctx)).toEqual([expect.stringContaining('нет в QUESTS')])
  })

  it('обложка: локальный cover.png → заливка; только PROMPT.md → владелец; ничего → агент пишет промпт', () => {
    expect(nextSteps('with-cover', ['cover'], ctx)[0]).toContain('upload-missing-quest-covers-prod.js --dry-run --quest-id=with-cover')
    expect(nextSteps('with-prompt', ['cover'], ctx)[0]).toContain('ждёт генерации владельцем')
    expect(nextSteps('nothing-here', ['cover'], ctx)[0]).toContain('агент пишет')
  })

  it('нет обложки и видео — порядок: сначала обложка', () => {
    expect(nextSteps('with-prompt', ['cover', 'finale_video'], ctx)).toContain('порядок: сначала обложка — видео финала собирается из неё')
  })

  it('без текста финала видео не предлагается', () => {
    const steps = nextSteps('mapped-quest', ['finale_text', 'finale_video'], ctx)
    expect(steps.join('\n')).not.toContain('generate-quest-finale-videos.js --quest-id')
  })
})

describe('scanMediaGaps', () => {
  it('отдаёт только квесты с пропусками', () => {
    const findings = scanMediaGaps([complete('ok', 1), { ...complete('mapped-quest', 2), finale: { text: 'Ф' } }], ctx)
    expect(findings).toEqual([
      expect.objectContaining({ id: 2, quest_id: 'mapped-quest', gaps: ['finale_video', 'finale_poster'] }),
    ])
  })
})

describe('parseArgs', () => {
  it('--quest-id через запятую — партия без дублей', () => {
    expect(parseArgs(['--quest-id=a, b,a,,c']).questIds).toEqual(['a', 'b', 'c'])
    expect(parseArgs([]).questIds).toBeNull()
  })

  it('опечатка во флаге — ошибка вызова, а не прогон по умолчанию', () => {
    expect(() => parseArgs(['--quest-ids=a'])).toThrow(UsageError)
  })
})

describe('main — исход прогона', () => {
  it('чистый каталог: без ошибки, пустой список', async () => {
    mockProd([complete('a', 1), complete('b', 2)])
    await expect(main(argv(), { ctx })).resolves.toEqual([])
  })

  it('фикстура с пропуском: ExpectedFailureError (exit 1) и квест в отчёте', async () => {
    mockProd([complete('a', 1), { ...complete('mapped-quest', 2), finale: { text: 'Ф', video_url: null, poster_url: null } }])
    await expect(main(argv(), { ctx })).rejects.toThrow(ExpectedFailureError)
    const printed = (console.log as jest.Mock).mock.calls.flat().join('\n')
    expect(printed).toContain('mapped-quest')
    expect(printed).toContain('нет видео финала')
  })

  it('--quest-id проверяет только партию и не ходит в каталог', async () => {
    mockProd([complete('a', 1), complete('b', 2)])
    await expect(main(argv('--quest-id=b'), { ctx })).resolves.toEqual([])
    expect((fetchJson as jest.Mock).mock.calls.map(([url]) => url)).toEqual([`${API}/api/quests/by-quest-id/b/`])
  })

  it('недоступный прод — ошибка, а не «пропусков нет»', async () => {
    ;(fetchJson as jest.Mock).mockRejectedValue(Object.assign(new Error('502 Bad Gateway'), { statusCode: 502 }))
    await expect(main(argv(), { ctx })).rejects.toThrow('502')
  })

  it('пустой каталог — отказ, а не зелёный «0 проверено»', async () => {
    mockProd([])
    await expect(main(argv(), { ctx })).rejects.toThrow(/0 квестов/)
  })
})
