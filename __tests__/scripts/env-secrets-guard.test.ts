import path from 'node:path'

import {
  makeTempDir,
  removeDir,
  runNodeCli,
  writeTextFile,
} from './cli-test-utils'

const repoRoot = path.resolve(__dirname, '../..')
const guardPath = path.join(repoRoot, 'scripts/guard-env-secrets.js')
const { findKeyLiterals } = require('../../scripts/guard-env-secrets')

// Образцы собираются при запуске: литерал формата ключа в самом тесте был бы
// нарушением того правила, которое тест проверяет (#3211).
const HEX40 = 'c0ffee12'.repeat(5)
const scanSource = (fileName: string, content: string) => {
  const tempRoot = makeTempDir('metravel-secret-guard-')
  const fixturePath = path.join(tempRoot, fileName)
  writeTextFile(fixturePath, content)
  try {
    const result = runNodeCli([guardPath, '--scan-file', fixturePath])
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` }
  } finally {
    removeDir(tempRoot)
  }
}

describe('environment and secret guard', () => {
  it('passes for the tracked repository files', () => {
    const result = runNodeCli([guardPath])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })

  it('fails closed without printing a synthetic secret value', () => {
    const tempRoot = makeTempDir('metravel-secret-guard-')
    const fixturePath = path.join(tempRoot, 'runtime-config.yml')
    const sentinel = 'synthetic-private-value-never-print'
    writeTextFile(
      fixturePath,
      `METRAVEL_TASK_BOARD_API_TOKEN: ${sentinel}\n`,
    )

    try {
      const result = runNodeCli([guardPath, '--scan-file', fixturePath])
      const output = `${result.stdout}\n${result.stderr}`

      expect(result.status).toBe(1)
      expect(output).toContain('METRAVEL_TASK_BOARD_API_TOKEN')
      expect(output).not.toContain(sentinel)
    } finally {
      removeDir(tempRoot)
    }
  })
})

describe('key literals in source files (#3211)', () => {
  it('rejects a quoted 40-hex key in a script and reports the line, not the value', () => {
    const { status, output } = scanSource('update-some-quest.js', `// one-off\nconst TOKEN = '${HEX40}';\n`)

    expect(status).toBe(1)
    expect(output).toContain('update-some-quest.js:2: 40-hex key literal')
    expect(output).not.toContain(HEX40)
  })

  it.each([
    ['authorization header', `curl -H "Authorization: Token ${HEX40}" https://example.test/`, 'authorization header'],
    ['GitHub token', `export GH=${'ghp_'}${'a1B2'.repeat(9)}`, 'GitHub token'],
    ['Slack token', `slack: ${'xoxb-'}${'123456789012-'.repeat(2)}abcdef`, 'Slack token'],
    ['Stripe live key', `stripe = "${'sk_live_'}${'a1B2'.repeat(6)}"`, 'Stripe live key'],
    ['Telegram bot token', `bot ${'1234567890'}:${'AA'}${'h'.repeat(33)}`, 'Telegram bot token'],
    ['private key block', `${'-----BEGIN '}PRIVATE KEY-----\\n${'MIIEvQIBADANBgkqhkiG9w0BAQEF'.repeat(2)}`, 'private key block'],
  ])('rejects a %s in any text file, markdown included', (_name, line, reason) => {
    const { status, output } = scanSource('notes.md', `# Runbook\n\n${line}\n`)

    expect(status).toBe(1)
    expect(output).toContain(`notes.md:3: ${reason}`)
    expect(output).not.toContain(line)
  })

  it('does not take a git object id or a checksum for a key', () => {
    const source = [
      `const SHA = '${HEX40}'`,
      `const baseSha = "${HEX40}"`,
      `  commit: '${HEX40}',`,
      `const fileChecksum = \`${HEX40}\``,
      `// see https://example.test/blob/${HEX40}/src/he.js`,
      `const detector = /-----BEGIN PRIVATE KEY-----/`,
    ].join('\n')

    expect(findKeyLiterals(source)).toEqual([])
    expect(scanSource('pins.js', source).status).toBe(0)
  })

  it('keeps flagging a key whose name merely contains a git word', () => {
    expect(findKeyLiterals(`const shareToken = '${HEX40}'`)).toEqual([{ line: 1, reason: '40-hex key literal' }])
  })

  it('leaves bare commit references in prose alone', () => {
    expect(scanSource('CHANGELOG.md', `Fixed in \`${HEX40}\`.\n`).status).toBe(0)
  })
})
