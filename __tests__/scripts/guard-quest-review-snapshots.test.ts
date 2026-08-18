const { evaluateGuard, hasSnapshotShape, buildJsonResult, OUTPUT_CONTRACT_VERSION } = require('@/scripts/guard-quest-review-snapshots')

// Реальная форма снимка ревью: так выглядели файлы scripts/review/*.json,
// которые скрипт применения молча заливал на прод (#1448).
const snapshot = JSON.stringify({
  intro: { step_id: 'intro', story: 'текст', task: 'нажми «Начать»' },
  steps: [{ step_id: 'dom', hint: 'Красный, прямоугольный, обожжён в печи', answer_pattern: { type: 'exact_any', value: '["кирпич"]' } }],
  finale: { text: 'финал' },
})

describe('guard-quest-review-snapshots', () => {
  it('ловит снимок контента квеста, закоммиченный под scripts/ (негативная проба)', () => {
    const result = evaluateGuard({ files: [{ path: 'scripts/quest-content-backup.json', content: snapshot }] })

    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].file).toBe('scripts/quest-content-backup.json')
    expect(result.violations[0].reason).toContain('снимок контента квеста')
  })

  it('ловит любой tracked-файл в возвращённом каталоге scripts/review/', () => {
    const result = evaluateGuard({ files: [{ path: 'scripts/review/torun-copernicus.json', content: snapshot }] })

    expect(result.ok).toBe(false)
    expect(result.violations[0].reason).toContain('не хранится в репозитории')
  })

  it('ловит снимок, закоммиченный в gitignored рабочий каталог', () => {
    const result = evaluateGuard({ files: [{ path: 'scripts/.quest-review/applied/2026-08-18-minsk-loshitsa.json', content: snapshot }] })

    expect(result.ok).toBe(false)
    expect(result.violations[0].reason).toContain('gitignored')
  })

  it('пропускает источники создания квестов и обычные JSON scripts/ (позитивная проба)', () => {
    const result = evaluateGuard({
      files: [
        { path: 'scripts/minsk-loshitsa-quest-data.js', content: 'module.exports = [{ quest_id: "minsk-loshitsa", steps: [{ step_id: "1" }] }]' },
        { path: 'scripts/seo-index-queue.json', content: JSON.stringify({ urls: ['https://metravel.by/'] }) },
        { path: 'scripts/minsk-guide-points.json', content: JSON.stringify([{ name: 'Лошица', lat: 53.85 }]) },
        { path: 'components/quests/QuestStepCard.tsx', content: 'export const QuestStepCard = () => null' },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('не считает снимком JSON без step_id в шагах', () => {
    expect(hasSnapshotShape({ steps: [{ title: 'без step_id' }] })).toBe(false)
    expect(hasSnapshotShape({ steps: [{ step_id: 'dom' }] })).toBe(true)
    expect(hasSnapshotShape({ intro: { step_id: 'intro' } })).toBe(true)
    expect(hasSnapshotShape(null)).toBe(false)
    expect(hasSnapshotShape([{ step_id: 'dom' }])).toBe(false)
  })

  it('отдаёт версионированный JSON-контракт', () => {
    const result = evaluateGuard({ files: [] })

    expect(buildJsonResult(result)).toMatchObject({
      contractVersion: OUTPUT_CONTRACT_VERSION,
      ok: true,
      violations: [],
    })
  })
})
