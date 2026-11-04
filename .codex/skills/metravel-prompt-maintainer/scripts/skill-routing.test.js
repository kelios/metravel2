const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const root = path.resolve(__dirname, '../../../..')
const guide = readFileSync(path.join(root, 'docs/CODEX.md'), 'utf8')
const router = guide.split('## Быстрый router')[1]
const rows = router.trimStart().split(/\n\s*\n/, 1)[0]
  .split('\n').filter(line => line.startsWith('|'))
  .map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replaceAll('`', '')))

const scenarios = [
  ['Проверь точечно unit-тест парсинга дат перед ревью.', 'Разовый code-level check', 'test-runner', /без runtime в review/],
  ['Сделай code review diff карты, тикет в review.', 'Ревью diff', 'code-reviewer', /review, только code-level/, /checks start only after the reviewed commit enters `testing`/],
  ['Пройдись по каталогу и воспроизведи жалобу на пустой экран.', 'Поиск и воспроизведение дефекта', 'qa-agent', /read-only по умолчанию/, /QA is read-only by default/],
  ['Тикет в testing, прими новый layout карточек на выкаченном SHA.', 'Приёмка конкретного web-изменения', 'browser-reviewer', /testing, проверенный SHA/, /testing-only/],
  ['Падает существующий Playwright-тест фильтров, найди причину.', 'Запуск или диагностика Playwright', 'e2e-runner', /только testing.*operation gate/, /operation coordination rule/],
  ['Разберись, кто владеет проблемой с картой, профилем и API.', 'Неясная работа с несколькими зонами или высоким риском', 'codex-orchestrator', /triage.*владельца и evidence layer/],
  ['План согласован, передай реализацию, независимое ревью и приёмку их владельцам.', 'Согласованный scope с независимыми стадиями', 'agent-workflow', /handoff, отдельно review и testing/, /Review is code-only/],
  ['Почему GET API отдаёт 500? Проверь причину по коду.', 'Backend/API diagnosis', 'backend-diagnostician', /read-only/, /Do not modify its working tree/],
  ['Собери подписанный iOS-кандидат.', 'iOS build, upload, submit или release', 'ios-release-operator', /отдельное точное разрешение/, /for one stage does not authorize the next/],
]

for (const [request, scope, skill, boundary, bodyContract] of scenarios) {
  test(request, () => {
    const routes = rows.filter(([label]) => label === scope)
    assert.equal(routes.length, 1, `Expected one documented route for ${scope}`)
    assert.equal(routes[0][1], `$metravel-${skill}`)
    assert.match(routes[0][2], boundary)

    const body = readFileSync(path.join(root, '.codex/skills', `metravel-${skill}`, 'SKILL.md'), 'utf8')
    assert.match(body, new RegExp(`^name: metravel-${skill}$`, 'm'))
    if (bodyContract) assert.match(body, bodyContract)
  })
}
