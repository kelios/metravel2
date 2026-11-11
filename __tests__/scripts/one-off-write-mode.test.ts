import fs from 'node:fs'
import path from 'node:path'

const { resolveOneOffWriteMode } = require('../../scripts/lib/one-off-write-mode')

const scriptsDir = path.resolve(__dirname, '../../scripts')
const options = { script: '/repo/scripts/migrate-fixture-quest.js', valueFlags: ['api-url', 'token'] }

describe('one-off quest write mode (#3211)', () => {
  let exit: jest.SpyInstance
  let stderr: jest.SpyInstance
  let stdout: jest.SpyInstance

  beforeEach(() => {
    exit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)
    stderr = jest.spyOn(console, 'error').mockImplementation(() => {})
    stdout = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    exit.mockRestore()
    stderr.mockRestore()
    stdout.mockRestore()
  })

  it('rehearses unless --apply is given', () => {
    expect(resolveOneOffWriteMode([], options)).toEqual({ isDryRun: true })
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('--apply'))
    expect(resolveOneOffWriteMode(['--dry-run'], options)).toEqual({ isDryRun: true })
    expect(resolveOneOffWriteMode(['--apply', '--api-url=https://example.test', '--token=a=b'], options)).toEqual({ isDryRun: false })
  })

  it.each([
    [['--dryrun']],
    [['--aply']],
    [['-dry-run']],
    [['--dry-run', '--apply']],
    [['--apply=true']],
    [['--api-url', 'https://example.test']],
    [['--only=x']],
  ])('refuses %j with exit code 2 instead of falling back to a mode', (tokens) => {
    expect(() => resolveOneOffWriteMode(tokens, options)).toThrow('exit 2')
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('[migrate-fixture-quest]'))
  })

  // #3304: у `create-*-guide.js` и `upload-quest-*.js` есть свои переключатели без значения.
  it('accepts declared boolean switches and still refuses undeclared ones', () => {
    const withSwitches = { ...options, booleanFlags: ['publish', 'with-points'] }
    expect(resolveOneOffWriteMode(['--publish', '--with-points'], withSwitches)).toEqual({ isDryRun: true })
    expect(resolveOneOffWriteMode(['--apply', '--publish'], withSwitches)).toEqual({ isDryRun: false })
    expect(() => resolveOneOffWriteMode(['--apply', '--publsh'], withSwitches)).toThrow('exit 2')
    expect(() => resolveOneOffWriteMode(['--apply', '--publish=yes'], withSwitches)).toThrow('exit 2')
    expect(() => resolveOneOffWriteMode(['--help'], withSwitches)).toThrow('exit 0')
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('[--publish] [--with-points]'))
  })

  it('answers --help with the usage and does not run', () => {
    expect(() => resolveOneOffWriteMode(['--help', '--apply'], options)).toThrow('exit 0')
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('--dry-run | --apply'))
  })

  // Семейство — копии одного шаблона: следующая копия со старым `args.includes`
  // снова писала бы на прод без флагов.
  it('every one-off quest script takes its mode from the shared helper', () => {
    const family = fs.readdirSync(scriptsDir)
      .filter((name) => /^(?:migrate-.+-quests?|reorder-quest-steps-prod)\.js$/.test(name))
    expect(family.length).toBeGreaterThan(50)
    const handRolled = family.filter((name) => {
      const source = fs.readFileSync(path.join(scriptsDir, name), 'utf8')
      return !source.includes("require('./lib/one-off-write-mode').resolveOneOffWriteMode(args,")
        || /\.includes\(\s*['"]--(?:dry-run|apply)['"]\s*\)/.test(source)
    })
    expect(handRolled).toEqual([])
  })
})
