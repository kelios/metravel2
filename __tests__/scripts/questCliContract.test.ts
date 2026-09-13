/**
 * #1934: квестовое CLI отказывается от неизвестного имени флага.
 * До фикса `argv.find(a => a.startsWith('--source='))` глотал опечатку и
 * уходил в дефолт: `--quest-id` сканировал весь корпус, `--dryrun` писал на прод.
 */

const { UsageError } = require('@/scripts/lib/cli-contract')
const { parseArgs: parseDrift } = require('@/scripts/scan-quest-prod-drift')
const { parseArgs: parseHint } = require('@/scripts/scan-quest-hint-leak')
const { parseArgs: parseSync } = require('@/scripts/sync-quest-to-prod')
const { parseArgs: parseMigrate } = require('@/scripts/migrate-quest-from-file')
const { parseArgs: parseApply } = require('@/scripts/apply-quest-patches')

describe('quest CLI contract #1934', () => {
  it('scan-quest-prod-drift отказывается от --quest-id, а не обходит весь корпус', () => {
    expect(() => parseDrift(['--quest-id=brest-lantern'])).toThrow(UsageError)
    expect(() => parseDrift(['--quest-id=brest-lantern'])).toThrow(
      'Unknown argument: --quest-id=brest-lantern',
    )
  })

  it('scan-quest-hint-leak отказывается от опечатки в имени флага и от выдуманного флага', () => {
    expect(() => parseHint(['--questid=brest-lantern'])).toThrow('Unknown argument: --questid=brest-lantern')
    expect(() => parseHint(['--frobnicate=1'])).toThrow('Unknown argument: --frobnicate=1')
  })

  it('пишущие скрипты отказываются от опечатки в --dry-run вместо боевой записи', () => {
    expect(() => parseSync(['--source-file=scripts/x-quest-data.js', '--dryrun'])).toThrow(
      'Unknown argument: --dryrun',
    )
    expect(() => parseMigrate(['--source-file=scripts/x-quest-data.js', '--dry_run'])).toThrow(
      'Unknown argument: --dry_run',
    )
    expect(() => parseApply(['--dryrun', 'patches.json'])).toThrow('Unknown argument: --dryrun')
  })

  it('пишущие скрипты требуют явный --dry-run или --apply, дефолта нет', () => {
    expect(() => parseSync(['--source-file=scripts/x-quest-data.js'])).toThrow('Режим не выбран')
    expect(() => parseMigrate(['--source-file=scripts/x-quest-data.js'])).toThrow('Режим не выбран')
    expect(() => parseApply(['patches.json'])).toThrow('Режим не выбран')
  })
})
