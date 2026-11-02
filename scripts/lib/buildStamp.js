// Отметки времени прод-сборки (#2930): `build-version` в HTML и `recordedAt` в
// `.build-source.json` берутся от времени коммита, а не от текущего времени.
// Сервер хранит релиз неизменяемым по sha и сверяет digest всех файлов
// (`../metravel-backend:deploy/prod/web_ssr_release.py`); с меткой «сейчас»
// повторная сборка того же sha после отката давала другой digest, и релиз
// отклонялся. Время коммита одно для всех сборок одного sha.
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '..', '..')

function commitTimeMs(rev = 'HEAD', cwd = repoRoot) {
  try {
    const seconds = Number(execFileSync('git', ['show', '-s', '--format=%ct', rev], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim())
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
  } catch {
    return null
  }
}

// Вне git-чекаута детерминировать нечего — остаётся текущее время.
function resolveBuildTimeMs({ rev = 'HEAD', cwd = repoRoot, now = Date.now } = {}) {
  return commitTimeMs(rev, cwd) ?? now()
}

module.exports = { commitTimeMs, resolveBuildTimeMs }
