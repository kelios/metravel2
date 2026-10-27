/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, runCli } from './cli-test-utils'

describe('SSR publication pre-transfer checkout gate', () => {
  let fixture: string

  beforeEach(() => {
    const parent = path.resolve('.codex-temp', 'ssr-publication-tests')
    fs.mkdirSync(parent, { recursive: true })
    fixture = makeTempDir('run-', { root: parent })
    fs.mkdirSync(path.join(fixture, 'candidate', 'runtime'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'candidate', '.ssr-build.json'), '{}')
    fs.writeFileSync(path.join(fixture, 'ssh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$SSR_TEST_CALLS"\nif [ "$SSR_TEST_CAPABILITY" = error ]; then exit 1; fi\nprintf "%s\\n" "$SSR_TEST_CAPABILITY"\n', { mode: 0o755 })
    fs.writeFileSync(path.join(fixture, 'rsync'), '#!/bin/sh\nprintf "rsync\\n" >> "$SSR_TEST_CALLS"\n', { mode: 0o755 })
  })

  afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }))

  it.each(['error', '{"schema_version":1,"available":true,"enabled":false}', 'invalid JSON'])(
    'does not upload after a refused or invalid backend capability: %s', (capability) => {
      const calls = path.join(fixture, 'calls.txt')
      const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'a'.repeat(40), path.join(fixture, 'candidate')], {
        cwd: process.cwd(),
        env: {
          ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
          DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
          PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
          SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: capability,
        },
      })
      expect(result.status).not.toBe(0)
      const commands = fs.readFileSync(calls, 'utf8')
      expect(commands).toContain('web_ssr_release.py capability')
      expect(commands).not.toContain('rsync')
      expect(commands).not.toContain('preflight')
    },
  )
})
