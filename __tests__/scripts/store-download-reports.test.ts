/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { execFileSync, spawnSync } from 'node:child_process'

const { readStoreReports } = require('@/scripts/lib/store-download-reports')
const APPLE = 'apple-sales-summary'
const PLAY = 'google-play-installs'
const appleHeader = ['Provider', 'Apple Identifier', 'Product Type Identifier', 'Units', 'Begin Date', 'End Date']
const playHeader = ['Date', 'Package Name', 'Country', 'Daily Device Installs', 'Daily User Installs', 'Daily Device Uninstalls']
const apple = (rows: string[][] = []) => [appleHeader, ...rows].map((row) => row.join('\t')).join('\r\n')
const play = (rows: string[][] = []) => [playHeader, ...rows].map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(',')).join('\r\n')
const appleRow = (type: string, units = '2', app = '6801264369', from = '10/19/2026', to = from) => ['TEST', app, type, units, from, to]
const playRow = (day = '2026-10-19', country = 'US', devices = '5', users = '3', app = 'by.metravel.app') => [day, app, country, devices, users, '0']
const entry = (source = APPLE, extra = {}) => ({ source, file: source === APPLE ? 'apple.txt' : 'play.csv',
  from: '2026-10-19', to: source === APPLE ? '2026-10-19' : '2026-10-20', calendar: 'America/Los_Angeles', coverage: 'complete',
  ...(source === APPLE ? { appId: '6801264369' } : { packageName: 'by.metravel.app', dimension: 'country' }), ...extra,
})

let folder: string
beforeEach(() => {
  const root = path.resolve('.codex-temp/store-import-tests')
  fs.mkdirSync(root, { recursive: true })
  folder = fs.mkdtempSync(path.join(root, 'report-'))
})
afterEach(() => { fs.rmSync(folder, { recursive: true, force: true }) })
const manifest = (reports: unknown[]) => fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ schemaVersion: 1, reports }))
const write = (name: string, data: string | Buffer) => fs.writeFileSync(path.join(folder, name), data)
const result = () => readStoreReports(folder)
const period = (source = APPLE) => result().periods.find((p: any) => p.source === source)

describe('official store imports: metrics and coverage', () => {
  it('reads gzip Apple Summary Sales, filters portfolio apps and IAP, excludes updates and preserves two download types', () => {
    manifest([entry(APPLE, { file: 'summary.txt.gz' })])
    write('summary.txt.gz', gzipSync(apple([
      appleRow('1', '2'), appleRow('1F', '3'), appleRow('1T', '4'), appleRow('3', '5'), appleRow('3F', '6'),
      appleRow('7', '100'), appleRow('7F', '100'), appleRow('7T', '100'), appleRow('IAY', '200'),
      appleRow('IA1', '200', '9000000000'), appleRow('1', '300', '9000000001'),
    ])))
    expect(period()).toEqual({ source: APPLE, from: '2026-10-19', to: '2026-10-19', calendar: 'America/Los_Angeles',
      coverage: 'complete', status: 'collected', metrics: { firstTimeDownloads: 9, redownloads: 11 } })
  })

  it.each(['utf8', 'utf16le', 'utf16be'])('reads quoted Google CSV in %s and keeps device and user installs distinct', (encoding) => {
    manifest([entry(PLAY)])
    const csv = play([playRow(), playRow('2026-10-20', 'PL', '4', '2')])
    const bytes = encoding === 'utf8' ? Buffer.from(csv) : Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, 'utf16le')])
    if (encoding === 'utf16be') bytes.swap16()
    write('play.csv', bytes)
    expect(period(PLAY)).toMatchObject({ status: 'collected', metrics: { deviceInstalls: 9, userInstalls: 5 } })
  })

  it('accepts escaped quotes, commas and newlines in nonmetric Apple fields', () => {
    manifest([entry()])
    write('apple.txt', appleHeader.join('\t') + '\n"TEST, ""quoted""\nprovider"\t6801264369\t1\t2\t10/19/2026\t10/19/2026')
    expect(period().metrics.firstTimeDownloads).toBe(2)
  })

  it('accepts whole-unit Apple DECIMAL values without accepting fractional acquisitions', () => {
    manifest([entry()]); write('apple.txt', apple([appleRow('1F', '2.00'), appleRow('3F', '1.0')]))
    expect(period().metrics).toEqual({ firstTimeDownloads: 2, redownloads: 1 })
  })

  it('reads the full official Google schema while using only daily installation metrics', () => {
    manifest([entry(PLAY)])
    write('play.csv', [
      [...playHeader, 'Current Device Installs', 'Installs on active devices', 'Daily Device Upgrades', 'Current User Installs', 'Total User Installs', 'Daily User Uninstalls'].join(','),
      [...playRow(), '100', '90', '10', '80', '1000', '20'].join(','),
    ].join('\n'))
    expect(period(PLAY).metrics).toEqual({ deviceInstalls: 5, userInstalls: 3 })
  })

  it('preserves qualified zero but not missing, partial or wrong-app data', () => {
    manifest([entry()]); write('apple.txt', apple([appleRow('1', '0')]))
    expect(period().metrics).toEqual({ firstTimeDownloads: 0, redownloads: 0 })
    manifest([entry(APPLE, { coverage: 'partial' })])
    expect(period()).toMatchObject({ status: 'unavailable', reason: 'INCOMPLETE', metrics: { firstTimeDownloads: null, redownloads: null } })
    manifest([entry()]); write('apple.txt', apple([appleRow('1', '10', '1234567890')]))
    expect(period()).toMatchObject({ reason: 'APP_MISMATCH', metrics: { firstTimeDownloads: null } })
    manifest([])
    expect(result().sources[APPLE]).toMatchObject({ status: 'unavailable', reason: 'MISSING_REPORT' })
  })

  it('allows a header-only official complete export with explicit manifest identity and coverage', () => {
    manifest([entry(), entry(PLAY)])
    write('apple.txt', apple()); write('play.csv', play())
    expect(period().metrics).toEqual({ firstTimeDownloads: 0, redownloads: 0 })
    expect(period(PLAY).metrics).toEqual({ deviceInstalls: 0, userInstalls: 0 })
  })

  it('derives full-month totals from adjacent exact windows while preserving current partial months separately', () => {
    manifest([
      entry(APPLE, { from: '2026-09-01', to: '2026-09-15', file: 'first.txt' }),
      entry(APPLE, { from: '2026-09-16', to: '2026-09-30', file: 'second.txt' }), entry(),
    ])
    write('first.txt', apple([appleRow('1', '4', undefined, '09/01/2026', '09/15/2026')]))
    write('second.txt', apple([appleRow('3', '2', undefined, '09/16/2026', '09/30/2026')]))
    write('apple.txt', apple([appleRow('1', '3')]))
    expect(result().monthly['2026-09'][APPLE]).toEqual({ metrics: { firstTimeDownloads: 4, redownloads: 2 }, calendar: 'America/Los_Angeles', coverage: 'complete' })
    expect(result().monthly['2026-10']).toBeUndefined()
    expect(result().periods).toHaveLength(3)
  })

  it('does not guess month values from a cross-month Apple summary row or incomplete monthly coverage', () => {
    manifest([entry(APPLE, { from: '2026-08-01', to: '2026-09-30' })])
    write('apple.txt', apple([appleRow('1', '8', undefined, '08/01/2026', '09/30/2026')]))
    expect(period().metrics.firstTimeDownloads).toBe(8)
    expect(result().monthly).toEqual({})
    manifest([entry(APPLE, { from: '2026-09-02', to: '2026-09-30' })]); write('apple.txt', apple())
    expect(result().monthly).toEqual({})
  })

  it('qualifies complete zero months without requiring daily zero rows', () => {
    manifest([entry(PLAY, { from: '2024-02-01', to: '2024-02-29' })]); write('play.csv', play())
    expect(result().monthly['2024-02'][PLAY].metrics).toEqual({ deviceInstalls: 0, userInstalls: 0 })
  })
})

describe('official store imports: invalid data and independent sources', () => {
  it.each(['-1', 'NaN', '1.5', '', '9007199254740992'])('rejects unqualified Apple acquisition count %s', (units) => {
    manifest([entry()]); write('apple.txt', apple([appleRow('1', units)]))
    expect(period().reason).toBe('INVALID_METRIC')
  })

  it.each(['-1', 'NaN', '1.5', ''])('rejects invalid Google counts %s', (units) => {
    manifest([entry(PLAY)]); write('play.csv', play([playRow(undefined, undefined, units)]))
    expect(period(PLAY).reason).toBe('INVALID_METRIC')
  })

  it.each([
    [apple([appleRow('1', '1', undefined, '02/30/2026')]), 'INVALID_DATE'],
    [apple([appleRow('1', '1', undefined, '10/18/2026')]), 'INVALID_DATE'],
    [apple([appleRow('', '1')]), 'INVALID_FORMAT'],
    [apple([appleRow('unknown', '1')]), 'INVALID_FORMAT'],
    [apple([appleRow('1', '1'), appleRow('1', '1')]), 'DUPLICATE_ROW'],
    ['Apple Identifier\tProduct Type Identifier\tUnits\n6801264369\t1\t3', 'INVALID_FORMAT'],
    [appleHeader.join('\t') + '\n"unclosed', 'INVALID_FORMAT'],
    [appleHeader.join('\t') + '\n"closed"junk', 'INVALID_FORMAT'],
  ])('rejects malformed Apple schema/dates without using partial sums', (data, reason) => {
    manifest([entry()]); write('apple.txt', data)
    expect(period()).toMatchObject({ reason, metrics: { firstTimeDownloads: null } })
  })

  it('rejects a daily Apple report declared as a full month or concatenated with another report window', () => {
    manifest([entry(APPLE, { from: '2026-10-01', to: '2026-10-31' })])
    write('apple.txt', apple([appleRow('1', '1')]))
    expect(period()).toMatchObject({ reason: 'INVALID_DATE', metrics: { firstTimeDownloads: null } })
    expect(result().monthly).toEqual({})
    write('apple.txt', apple([appleRow('1', '1', undefined, '10/01/2026', '10/31/2026'), appleRow('1', '1')]))
    expect(period().reason).toBe('INVALID_DATE')
  })

  it('keeps distinct Apple country rows with equal counts', () => {
    manifest([entry()])
    write('apple.txt', [
      [...appleHeader, 'Country Code'].join('\t'),
      [...appleRow('1', '1'), 'PL'].join('\t'),
      [...appleRow('1', '1'), 'BY'].join('\t'),
    ].join('\n'))
    expect(period().metrics.firstTimeDownloads).toBe(2)
  })

  it.each([
    [play([playRow(), playRow()]), 'DUPLICATE_ROW'],
    [play([playRow(undefined, 'OVERALL')]), 'UNSUPPORTED_DIMENSION'],
    [play([playRow(undefined, undefined, undefined, undefined, 'foreign.app')]), 'APP_MISMATCH'],
    [playHeader.join(',') + ',App Version Code\n' + playRow().join(',') + ',1', 'UNSUPPORTED_DIMENSION'],
    [playHeader.join(',') + '\n' + playRow().slice(0, -1).join(','), 'INVALID_FORMAT'],
    ['Date,Package Name,Country,Current Device Installs,Total User Installs\n2026-10-19,by.metravel.app,PL,30,40', 'INVALID_FORMAT'],
  ])('rejects mixed/duplicate Google dimensions and foreign application', (data, reason) => {
    manifest([entry(PLAY)]); write('play.csv', data)
    expect(period(PLAY)).toMatchObject({ reason, metrics: { deviceInstalls: null, userInstalls: null } })
  })

  it('rejects both overlapping periods without damaging the independent store', () => {
    manifest([entry(), entry(APPLE, { from: '2026-10-19', to: '2026-10-20', file: 'other.txt' }), entry(PLAY)])
    write('apple.txt', apple([appleRow('1')]))
    write('other.txt', apple([appleRow('1', '2', undefined, '10/19/2026', '10/20/2026')]))
    write('play.csv', play([playRow()]))
    expect(result().periods.filter((p: any) => p.source === APPLE).map((p: any) => [p.reason, p.metrics.firstTimeDownloads])).toEqual([
      ['OVERLAPPING_PERIOD', null], ['OVERLAPPING_PERIOD', null],
    ])
    expect(period(PLAY).metrics).toEqual({ deviceInstalls: 5, userInstalls: 3 })
  })

  it.each([APPLE, PLAY])('rejects a wrong source calendar for %s while preserving the other store', (source) => {
    const other = source === APPLE ? PLAY : APPLE
    manifest([entry(source, { calendar: 'UTC' }), entry(other)])
    write('apple.txt', apple()); write('play.csv', play())
    expect(result().sources[source].status).toBe('unavailable')
    expect(period(source)).toBeUndefined()
    expect(period(other).status).toBe('collected')
    expect(result().gaps.join(' ')).toContain(`${source}: для официальных выгрузок нужен календарь America/Los_Angeles (PT) (UNSUPPORTED_CALENDAR)`)
  })

  it('keeps an independently valid store with an invalid manifest record for the other store', () => {
    manifest([entry(APPLE, { appId: 'foreign' }), entry(PLAY)])
    write('play.csv', play([playRow()]))
    expect(result().sources[APPLE].status).toBe('unavailable')
    expect(period(PLAY).status).toBe('collected')
    expect(result().gaps.join(' ')).toContain('APP_MISMATCH')
  })
})

describe('official store imports: bounded and private local inputs', () => {
  it('treats an absent optional directory as missing evidence', () => {
    const report = readStoreReports(path.join(folder, 'not-present'))
    expect(report.periods).toEqual([])
    expect(report.sources[APPLE]).toEqual({ status: 'unavailable', reason: 'MISSING_REPORT' })
  })

  it.each([['schemaVersion', 2], ['reports', 'secret-canary'], ['reports', Array(101).fill({})]])('rejects an unsupported manifest %s', (key, value) => {
    write('manifest.json', JSON.stringify({ schemaVersion: 1, reports: [], [key as string]: value }))
    expect(result().periods).toEqual([])
    expect(result().gaps.join(' ')).toContain('INVALID_MANIFEST')
    expect(JSON.stringify(result())).not.toContain('secret-canary')
  })

  it.each(['../private-canary', '..', '/private-canary'])('rejects path escape %s without leaking its content or path', (file) => {
    manifest([entry(APPLE, { file })])
    expect(period().reason).toBe('UNSAFE_PATH')
    expect(JSON.stringify(result())).not.toContain('private-canary')
  })

  it('rejects a symbolic link outside the reports directory, including manifest links', () => {
    const privateFile = path.join(folder, '../private-canary')
    fs.writeFileSync(privateFile, 'secret-canary')
    try {
      fs.symlinkSync(privateFile, path.join(folder, 'apple.txt'))
      manifest([entry()])
      expect(period().reason).toBe('UNSAFE_PATH')
      fs.unlinkSync(path.join(folder, 'manifest.json'))
      fs.symlinkSync(privateFile, path.join(folder, 'manifest.json'))
      expect(result().sources[APPLE].reason).toBe('UNSAFE_PATH')
      expect(JSON.stringify(result())).not.toMatch(/secret-canary|private-canary/)
    } finally { fs.unlinkSync(privateFile) }
  })

  it('rejects oversized on-disk and inflated files with bounded diagnostics', () => {
    manifest([entry()]); write('apple.txt', Buffer.alloc(16 * 1024 * 1024 + 1))
    expect(period().reason).toBe('SIZE_LIMIT')
    write('apple.txt', gzipSync(Buffer.alloc(64 * 1024 * 1024 + 1)))
    expect(period().reason).toBe('SIZE_LIMIT')
  })

  it('rejects a named pipe before opening it so local input cannot block the command', () => {
    manifest([entry()])
    execFileSync('mkfifo', [path.join(folder, 'apple.txt')])
    const child = spawnSync(process.execPath, ['-e', `
      const { readStoreReports } = require('./scripts/lib/store-download-reports');
      process.stdout.write(JSON.stringify(readStoreReports(process.argv[1]).periods[0]));
    `, folder], { cwd: path.resolve('.'), encoding: 'utf8', timeout: 3000 })
    expect(child.error).toBeUndefined()
    expect(child.status).toBe(0)
    expect(JSON.parse(child.stdout)).toMatchObject({ reason: 'INVALID_FORMAT', metrics: { firstTimeDownloads: null } })
  })

  it('rejects invalid UTF-8 and gzip without exposing raw errors', () => {
    manifest([entry()]); write('apple.txt', Buffer.from([0xff, 0xfe, 0xff]))
    expect(period().reason).toBe('INVALID_FORMAT')
    write('apple.txt', Buffer.from([0x1f, 0x8b, 0xff]))
    expect(period().reason).toBe('INVALID_FORMAT')
  })
})
