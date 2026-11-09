import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'

// #3208: остановку ночного бэкапа базы никто не замечал — `--verify` считал
// успешные ночи за всю историю лога и не смотрел возраст последнего архива.
// Правило возраста и порог живут в scripts/db-backup-freshness.py; тест держит
// само правило на каталоге-фикстуре, сквозной `--verify` (удалённая часть
// исполняется локально через подставной ssh с фиктивным HOME) и доставку модуля
// на хост установщиком ежедневной сводки.

const HELPER = path.join(process.cwd(), 'scripts', 'db-backup-freshness.py')
const VERIFY = path.join(process.cwd(), 'scripts', 'enable-prod-db-backup.sh')
const REPORT = path.join(process.cwd(), 'scripts', 'security-report.py')
const REPORT_INSTALLER = path.join(process.cwd(), 'scripts', 'enable-prod-security-report.sh')
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const DUMP_HEAD = '--\n-- PostgreSQL database dump\n--\n'

const archiveName = (takenAt: Date) =>
  `metravel-postgres-${takenAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.sql.gz`
const hoursBefore = (now: Date, hours: number) => new Date(now.getTime() - hours * HOUR_MS)
const utcDay = (at: Date) => at.toISOString().slice(0, 10)
// Колонка времени `aws s3 ls` — в зоне хоста и всегда «свежая»: возраст по ней не считается.
const s3Line = (name: string, size = 82315694) => `2026-11-09 02:15:47 ${String(size).padStart(10)} ${name}`
const completedLine = (day: string) =>
  `[${day}T23:15:52Z] Backup completed: /home/sx3/db-backups/metravel-postgres-x.sql.gz (82315694 bytes)`

function writeExecutable(filePath: string, lines: string[]) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
  fs.chmodSync(filePath, 0o755)
}

describe('scripts/db-backup-freshness.py', () => {
  const NOW = new Date('2026-11-09T22:16:00Z')
  let root: string
  let seq = 0

  beforeAll(() => {
    root = makeTempDir('db-backup-freshness-')
  })
  afterAll(() => removeDir(root))

  function runHelper(input: { local: number[]; s3: number[]; logs?: string[][]; now?: Date }) {
    const now = input.now ?? NOW
    const dir = path.join(root, `case-${(seq += 1)}`)
    const backups = path.join(dir, 'db-backups')
    fs.mkdirSync(backups, { recursive: true })
    // Файлы создаются сейчас: mtime у всех свежий, возраст задаёт только метка в имени.
    for (const hours of input.local) fs.writeFileSync(path.join(backups, archiveName(hoursBefore(now, hours))), 'x')
    fs.writeFileSync(path.join(backups, 'metravel-postgres-20261109T221500Z.sql.gz.partial'), 'x')
    const listing = path.join(dir, 's3.txt')
    fs.writeFileSync(
      listing,
      [`                           PRE old/`, ...input.s3.map((hours) => s3Line(archiveName(hoursBefore(now, hours))))].join('\n'),
    )
    const logArgs = (input.logs ?? []).flatMap((days, index) => {
      const file = path.join(dir, `backup.log${index ? `.${index}` : ''}`)
      fs.writeFileSync(file, `${days.map(completedLine).join('\n')}\n`)
      return ['--log', file]
    })
    return runCli('python3', [
      '-I', HELPER, '--backup-dir', backups, '--s3-listing', listing, '--now', now.toISOString(), ...logArgs,
    ])
  }

  it('архив возрастом 2 часа — успех, возраст в часах в выводе', () => {
    const result = runHelper({ local: [2, 26 + 24, 26 + 48], s3: [2, 26 + 24], logs: [['2026-11-08', '2026-11-07']] })
    expect(result.stdout).toContain('локальный архив: 2.0 ч — metravel-postgres-20261109T201600Z.sql.gz (порог 26 ч)')
    expect(result.stdout).toContain('объект в S3: 2.0 ч — metravel-postgres-20261109T201600Z.sql.gz (порог 26 ч)')
    expect(result.stdout).toContain('две последние ночи (сутки UTC 2026-11-08 и 2026-11-07): Backup completed в обеих')
    expect(result.stdout).not.toContain('❌')
    expect(result.status).toBe(0)
  })

  it('архив возрастом 48 часов — ошибка и слово ПРОСРОЧЕНО, хотя файл создан только что', () => {
    const result = runHelper({ local: [48, 72], s3: [48] })
    expect(result.stdout).toContain('❌ локальный архив: ПРОСРОЧЕНО — 48.0 ч при пороге 26 ч (metravel-postgres-20261107T221600Z.sql.gz)')
    expect(result.stdout).toContain('❌ объект в S3: ПРОСРОЧЕНО — 48.0 ч при пороге 26 ч')
    expect(result.status).toBe(1)
  })

  it('порог 26 часов включительно; копии в каталоге и в S3 проверяются порознь', () => {
    expect(runHelper({ local: [26], s3: [26] }).status).toBe(0)
    expect(runHelper({ local: [26.5], s3: [2] }).status).toBe(1)
    const s3Stale = runHelper({ local: [2], s3: [72] })
    expect(s3Stale.stdout).toMatch(/^локальный архив: 2\.0 ч/m)
    expect(s3Stale.stdout).toContain('❌ объект в S3: ПРОСРОЧЕНО — 72.0 ч')
    expect(s3Stale.status).toBe(1)
  })

  it('нет ни одного архива — ошибка, недописанный файл архивом не считается', () => {
    const result = runHelper({ local: [], s3: [] })
    expect(result.stdout).toContain('❌ локальный архив: ПРОСРОЧЕНО — архивов нет')
    expect(result.stdout).toContain('❌ объект в S3: ПРОСРОЧЕНО — архивов нет')
    expect(result.status).toBe(1)
  })

  it('метка архива из будущего — ошибка, а не «свежая копия»', () => {
    const result = runHelper({ local: [-5], s3: [2] })
    expect(result.stdout).toContain('❌ локальный архив: метка архива из будущего (-5.0 ч)')
    expect(result.status).toBe(1)
  })

  it('две ночи считаются по последним двум суткам, а не по всей истории лога', () => {
    const history = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-05', '2026-11-06']
    // Раньше хватало двух любых дат в логе: эта история давала «успешных ночей: 5».
    const stopped = runHelper({ local: [2], s3: [2], logs: [history] })
    expect(stopped.stdout).toContain('❌ две последние ночи (сутки UTC 2026-11-08 и 2026-11-07): нет Backup completed за 2026-11-08, 2026-11-07')
    expect(stopped.status).toBe(1)

    const oneMissed = runHelper({ local: [2], s3: [2], logs: [[...history, '2026-11-08']] })
    expect(oneMissed.stdout).toContain('нет Backup completed за 2026-11-07')
    expect(oneMissed.status).toBe(1)
  })

  it('после сегодняшнего прогона пара суток сдвигается на сегодня и вчера; ротированный лог учитывается', () => {
    const afterRun = new Date('2026-11-09T23:30:00Z')
    const shifted = runHelper({ local: [0.2], s3: [0.2], logs: [['2026-11-09', '2026-11-08']], now: afterRun })
    expect(shifted.stdout).toContain('две последние ночи (сутки UTC 2026-11-09 и 2026-11-08): Backup completed в обеих')
    expect(shifted.status).toBe(0)

    const rotated = runHelper({ local: [2], s3: [2], logs: [['2026-11-08'], ['2026-11-07']] })
    expect(rotated.status).toBe(0)
  })
})

describe('удалённая часть на фиктивном хосте (подставной ssh)', () => {
  let root: string
  let seq = 0

  beforeAll(() => {
    root = makeTempDir('db-backup-host-')
  })
  afterAll(() => removeDir(root))

  // Подставной ssh исполняет payload локальным bash с HOME=фикстура; настоящий
  // хост недостижим в принципе: адрес — из зарезервированной зоны .test, а
  // .env.deploy подменён несуществующим файлом.
  function makeHost() {
    const dir = path.join(root, `host-${(seq += 1)}`)
    const home = path.join(dir, 'home')
    const bin = path.join(dir, 'bin')
    fs.mkdirSync(home, { recursive: true })
    writeExecutable(path.join(bin, 'ssh'), ['#!/bin/bash', 'export HOME="$FAKE_HOME"', 'exec bash -s'])
    writeExecutable(path.join(bin, 'crontab'), [
      '#!/bin/bash',
      'echo "$*" >> "$FAKE_HOME/crontab.calls"',
      'if [[ "${1:-}" == "-l" ]]; then echo "15 2 * * * $FAKE_HOME/.local/bin/metravel-db-backup # metravel-db-backup"; fi',
    ])
    const env = {
      PATH: `${bin}:${process.env.PATH}`,
      FAKE_HOME: home,
      DEPLOY_ENV_FILE: path.join(dir, 'absent.env.deploy'),
      PROD_SSH_USER: 'nobody',
      PROD_SSH_HOST: 'prod-fixture.test',
      PROD_REMOTE_DIR: '/nonexistent',
    }
    return { home, env }
  }

  function seedBackup(home: string, ageHours: number, logDays: string[]) {
    const backups = path.join(home, 'db-backups')
    const archive = zlib.gzipSync(DUMP_HEAD)
    const name = archiveName(hoursBefore(new Date(), ageHours))
    fs.mkdirSync(backups, { recursive: true })
    fs.writeFileSync(path.join(backups, name), archive)
    fs.writeFileSync(path.join(home, 's3-listing.txt'), `${s3Line(name, archive.length)}\n`)
    writeExecutable(path.join(home, '.local', 'bin', 'aws'), ['#!/bin/bash', 'cat "$HOME/s3-listing.txt"'])
    fs.mkdirSync(path.join(home, 'logs'), { recursive: true })
    fs.writeFileSync(path.join(home, 'logs', 'metravel-db-backup.log'), `${logDays.map(completedLine).join('\n')}\n`)
    fs.writeFileSync(
      path.join(home, '.metravel-backup.env'),
      [
        'S3_URI=s3://fixture-bucket/postgres',
        `BACKUP_DIR=${backups}`,
        'RETENTION_DAYS=5',
        `AWS_CLI=${path.join(home, '.local', 'bin', 'aws')}`,
        `LOG_FILE=${path.join(home, 'logs', 'metravel-db-backup.log')}`,
        '',
      ].join('\n'),
    )
  }

  const daysAgo = (days: number) => utcDay(new Date(Date.now() - days * DAY_MS))

  it('--verify зелёный на свежей копии и печатает её возраст в часах', () => {
    const { home, env } = makeHost()
    seedBackup(home, 2, [daysAgo(2), daysAgo(1), daysAgo(0)])
    const result = runCli('bash', [VERIFY, '--verify'], { env })
    expect(result.stdout).toContain('== 5. свежесть копий ==')
    expect(result.stdout).toMatch(/^локальный архив: 2\.0 ч — metravel-postgres-\d{8}T\d{6}Z\.sql\.gz \(порог 26 ч\)$/m)
    expect(result.stdout).toMatch(/^объект в S3: 2\.0 ч/m)
    expect(result.stdout).toContain('совпадение размеров: OK')
    expect(result.stdout).toContain('✅ бэкап в норме')
    expect(result.status).toBe(0)
    // проверка ничего не пишет: crontab только читается
    expect(fs.readFileSync(path.join(home, 'crontab.calls'), 'utf8').trim()).toBe('-l')
  })

  it('--verify падает на копии двухдневной давности, хотя расписание, gzip и S3 в порядке', () => {
    const { home, env } = makeHost()
    seedBackup(home, 48, [daysAgo(4), daysAgo(3), daysAgo(2)])
    const result = runCli('bash', [VERIFY, '--verify'], { env })
    // всё, на что смотрела прежняя проверка, по-прежнему зелёное
    expect(result.stdout).toContain('gzip -t: OK')
    expect(result.stdout).toContain('заголовок дампа: OK')
    expect(result.stdout).toContain('совпадение размеров: OK')
    expect(result.stdout).toMatch(/❌ локальный архив: ПРОСРОЧЕНО — 48\.0 ч при пороге 26 ч/)
    expect(result.stdout).toMatch(/❌ объект в S3: ПРОСРОЧЕНО — 48\.0 ч/)
    expect(result.stdout).toContain('нет Backup completed за')
    expect(result.stdout).toContain('⚠️ проверка не пройдена')
    expect(result.status).not.toBe(0)
  })

  it('--verify доходит до свежести и падает, когда архивов и листинга S3 нет вовсе', () => {
    const { home, env } = makeHost()
    seedBackup(home, 2, [daysAgo(1), daysAgo(0)])
    fs.rmSync(path.join(home, 'db-backups'), { recursive: true })
    writeExecutable(path.join(home, '.local', 'bin', 'aws'), ['#!/bin/bash', 'echo "AccessDenied" >&2', 'exit 255'])
    const result = runCli('bash', [VERIFY, '--verify'], { env })
    expect(result.stdout).toContain('❌ листинг S3 не удался')
    expect(result.stdout).toContain('❌ локальный архив: ПРОСРОЧЕНО — каталог не читается')
    expect(result.stdout).toContain('❌ объект в S3: ПРОСРОЧЕНО — архивов нет')
    expect(result.status).not.toBe(0)
  })

  it('--verify не берёт возраст S3 из частичного вывода упавшего aws', () => {
    const { home, env } = makeHost()
    seedBackup(home, 2, [daysAgo(1), daysAgo(0)])
    writeExecutable(path.join(home, '.local', 'bin', 'aws'), ['#!/bin/bash', 'cat "$HOME/s3-listing.txt"', 'exit 255'])
    const result = runCli('bash', [VERIFY, '--verify'], { env })
    expect(result.stdout).toContain('❌ листинг S3 не удался')
    expect(result.stdout).toContain('❌ объект в S3: ПРОСРОЧЕНО — архивов нет')
    expect(result.status).not.toBe(0)
  })

  it('установщик сводки доставляет модуль рядом с отчётом, и отчёт находит его по префиксу имени', () => {
    const { home, env } = makeHost()
    seedBackup(home, 2, [daysAgo(1), daysAgo(0)])
    writeExecutable(path.join(home, '.local', 'bin', 'metravel-security-report'), ['#!/bin/bash', 'exit 0'])
    const install = runCli('bash', [REPORT_INSTALLER, '--update-script'], { env })
    expect(install.stdout).toContain('скрипты обновлены')
    expect(install.status).toBe(0)

    const installedReport = path.join(home, '.local', 'bin', 'metravel-security-report.py')
    const installedModule = path.join(home, '.local', 'bin', 'metravel-db-backup-freshness.py')
    expect(fs.readFileSync(installedReport, 'utf8')).toBe(fs.readFileSync(REPORT, 'utf8'))
    expect(fs.readFileSync(installedModule, 'utf8')).toBe(fs.readFileSync(HELPER, 'utf8'))
    // режим обновления скриптов не трогает crontab и конфиг со своими адресами
    expect(fs.existsSync(path.join(home, 'crontab.calls'))).toBe(false)
    expect(fs.existsSync(path.join(home, '.metravel-security-report.env'))).toBe(false)
    expect(fs.readdirSync(path.join(home, '.local', 'bin')).sort()).toEqual([
      'aws', 'metravel-db-backup-freshness.py', 'metravel-security-report', 'metravel-security-report.py',
    ])

    // --verify установщика ловит расхождение копии на хосте с репозиторием
    const DRIFT = 'отличается от репозитория'
    expect(runCli('bash', [REPORT_INSTALLER, '--verify'], { env }).stdout).not.toContain(DRIFT)
    fs.appendFileSync(installedModule, '\nMAX_AGE_HOURS = 99\n')
    expect(runCli('bash', [REPORT_INSTALLER, '--verify'], { env }).stdout).toContain(`❌ ${installedModule} ${DRIFT}`)
    fs.writeFileSync(installedModule, fs.readFileSync(HELPER, 'utf8'))

    const empty = path.join(home, 'empty.log')
    fs.writeFileSync(empty, '')
    const report = runCli('python3', [
      '-I', installedReport, '--dry-run', '--no-host', '--nginx-log', empty, '--fail2ban-log', empty,
      '--auth-log', empty, '--moderation-log', empty, '--relay-log', empty, '--robots', empty,
      '--state', path.join(home, 'state.json'),
      '--backup-dir', path.join(home, 'db-backups'), '--backup-s3-listing', path.join(home, 's3-listing.txt'),
    ])
    expect(report.status).toBe(0)
    expect(report.stdout).toMatch(/Последняя копия, локальный архив: 2\.0 ч — metravel-postgres-/)
    expect(report.stdout).not.toContain('возраст не проверен')
  })
})
