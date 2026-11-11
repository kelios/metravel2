import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const INSTALLER = path.join(process.cwd(), 'scripts', 'enable-prod-security-report.sh')
const DOC = path.join(process.cwd(), 'docs', 'ops', 'security-report.md')
const MARK = '# metravel-security-report'
// Строка, которая стоит на прод-хосте (вывод --verify 09.11.2026, #3266); `~` — домашний каталог.
const hostLine = (home: string) =>
  `0 10,11 * * * test "$(TZ=Europe/Warsaw /bin/date +\\%H)" = 09 && ${home}/.local/bin/metravel-security-report ${MARK}`

describe('scripts/enable-prod-security-report.sh: расписание (#3266)', () => {
  let root: string

  beforeAll(() => { root = makeTempDir('security-report-schedule-') })
  afterAll(() => removeDir(root))

  // «Хост» — локальный bash с подменённым HOME; crontab только читается из файла.
  function verifyAgainst(crontabLines: (home: string) => string[], extraEnv: Record<string, string> = {}) {
    const dir = makeTempDir('host-', { root })
    const home = path.join(dir, 'home')
    const bin = path.join(dir, 'bin')
    fs.mkdirSync(home, { recursive: true })
    fs.mkdirSync(bin, { recursive: true })
    const write = (name: string, lines: string[]) => {
      fs.writeFileSync(path.join(bin, name), `${lines.join('\n')}\n`)
      fs.chmodSync(path.join(bin, name), 0o755)
    }
    write('ssh', ['#!/bin/bash', 'export HOME="$FAKE_HOME"', 'exec bash -s'])
    write('crontab', [
      '#!/bin/bash',
      'echo "$*" >> "$FAKE_HOME/crontab.calls"',
      'if [[ "${1:-}" == "-l" ]]; then cat "$FAKE_HOME/crontab.txt"; fi',
    ])
    fs.writeFileSync(path.join(home, 'crontab.txt'), `${crontabLines(home).join('\n')}\n`)
    const result = runCli('bash', [INSTALLER, '--verify'], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_HOME: home,
        DEPLOY_ENV_FILE: path.join(dir, 'absent.env.deploy'),
        PROD_SSH_USER: 'nobody',
        PROD_SSH_HOST: 'prod-fixture.test',
        PROD_REMOTE_DIR: '/nonexistent',
        ...extraEnv,
      },
    })
    return { result, calls: fs.readFileSync(path.join(home, 'crontab.calls'), 'utf8').trim() }
  }

  const DRIFT = '❌ cron-строка хоста отличается от установщика'

  it('умолчание установщика — строка, которая стоит на хосте: 09:00 по Варшаве', () => {
    const { result, calls } = verifyAgainst((home) => ['15 2 * * * /bin/true # metravel-db-backup', hostLine(home)])

    expect(result.stdout).toContain('расписание совпадает с установщиком')
    expect(result.stdout).not.toContain(DRIFT)
    // проверка ничего не пишет: crontab только читается
    expect(calls).toBe('-l')
  })

  it('прежняя строка 09:10 по времени хоста — расхождение: ❌ и ненулевой код', () => {
    const { result, calls } = verifyAgainst((home) => [`10 9 * * * ${home}/.local/bin/metravel-security-report ${MARK}`])

    expect(result.stdout).toContain(DRIFT)
    expect(result.stdout).toMatch(/^ {2}хост: +10 9 \* \* \* /m)
    expect(result.stdout).toMatch(/^ {2}установщик: +0 10,11 \* \* \* test /m)
    expect(result.status).not.toBe(0)
    expect(calls).toBe('-l')
  })

  it.each([
    ['без условия по Варшаве', (home: string) => [`0 10,11 * * * ${home}/.local/bin/metravel-security-report ${MARK}`]],
    ['две строки с маркером', (home: string) => [hostLine(home), hostLine(home)]],
  ])('расхождение: %s', (_name, lines) => {
    const { result } = verifyAgainst(lines)
    expect(result.stdout).toContain(DRIFT)
    expect(result.status).not.toBe(0)
  })

  it('нет строки с маркером — отдельная ошибка, а не расхождение', () => {
    const { result } = verifyAgainst(() => ['15 2 * * * /bin/true # metravel-db-backup'])
    expect(result.stdout).toContain('❌ cron-строки нет')
    expect(result.stdout).not.toContain(DRIFT)
    expect(result.status).not.toBe(0)
  })

  it('своё расписание через CRON_SCHEDULE сверяется так же', () => {
    const custom = (home: string) => [`10 9 * * * ${home}/.local/bin/metravel-security-report ${MARK}`]
    expect(verifyAgainst(custom, { CRON_SCHEDULE: '10 9 * * *' }).result.stdout).toContain('расписание совпадает с установщиком')
  })

  it('документ называет то же время и ту же строку, что установщик', () => {
    const doc = fs.readFileSync(DOC, 'utf8')
    const installer = fs.readFileSync(INSTALLER, 'utf8')
    const schedule = /^DEFAULT_CRON_SCHEDULE='(.+)'$/m.exec(installer)?.[1]

    expect(schedule).toBe('0 10,11 * * * test "$(TZ=Europe/Warsaw /bin/date +\\%H)" = 09 &&')
    expect(doc).toContain(`${schedule} ~/.local/bin/metravel-security-report ${MARK}`)
    expect(doc).toContain('в 09:00 по Варшаве (Europe/Warsaw)')
    expect(doc).not.toMatch(/09:10|время хоста \(Europe\/Minsk\)|времени хоста \(Europe\/Minsk\)/)
  })
})
