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
    fs.writeFileSync(path.join(fixture, 'rsync'), '#!/bin/sh\nprintf "rsync %s\\n" "$*" >> "$SSR_TEST_CALLS"\n', { mode: 0o755 })
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

  // The explicit chunk limit is read on the host only after the stage has
  // sealed the release; a typo must not cost an upload and a seal.
  it('refuses a malformed explicit chunk limit before any transfer', () => {
    const calls = path.join(fixture, 'calls.txt')
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'a'.repeat(40), path.join(fixture, 'candidate')], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        SSR_RELEASE_JS_MAX_MB: '700MB',
        SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: '{"schema_version":1,"available":true,"enabled":true}',
      },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('SSR_RELEASE_JS_MAX_MB must be a whole number')
    const commands = fs.readFileSync(calls, 'utf8')
    expect(commands).not.toContain('rsync')
    expect(commands).not.toContain('preflight')
  })

  it('preserves hardlinks in the remote transfer after the unchanged disk preflight', () => {
    const calls = path.join(fixture, 'calls.txt')
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'a'.repeat(40), path.join(fixture, 'candidate')], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'false', DEPLOY_DISK_RESERVE_MB: '720', DEPLOY_BACKEND_BUILD_MB: '1536',
        SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: '{"schema_version":1,"available":true,"enabled":true}',
      },
    })
    expect(result.status).toBe(0)
    const commands = fs.readFileSync(calls, 'utf8').trim().split('\n')
    const transfer = commands.findIndex(command => command.startsWith('rsync '))
    const preflight = commands.findIndex(command => command.includes('bash -s -- preflight'))
    expect(preflight).toBeGreaterThan(0)
    expect(transfer).toBeGreaterThan(preflight)
    expect(commands[preflight]).toContain('720 1536')
    expect(commands[transfer]).toContain('rsync -azHhe ssh --delete --mkpath --protect-args ')
    expect(commands[transfer]).not.toContain('--exclude')
    expect(commands[transfer]).toContain('/web-ssr/incoming/'+'a'.repeat(40)+'/')
    // One transfer (book files live in S3, #2971); the sealed release is audited afterwards.
    expect(commands.filter(command => command.startsWith('rsync '))).toHaveLength(1)
    const audits = commands.filter(command => command.includes('bash -s -- books ') || command.includes('bash -s -- chunks '))
    expect(audits).toHaveLength(2)
    expect(audits[0]).toContain('bash -s -- books /owned/repository/web-ssr/releases/'+'a'.repeat(40)+'/client /owned/repository/web-ssr/shared/travel-books')
    expect(audits[1]).toMatch(/bash -s -- chunks \/owned\/repository\/web-ssr\/releases\/a{40}\/client \d+ 256$/)
    expect(commands.indexOf(audits[0])).toBeGreaterThan(commands.findIndex(command => command.includes('stage --sha')))
  })

  // Ready-book files live in S3 (#2971): the release carries only the
  // pointer `client/travel-books/manifest.json`, which travels with the rest of
  // the candidate in the one transfer the disk preflight sizes.
  it('carries the book pointer with the candidate and sizes the preflight by the whole candidate', () => {
    const calls = path.join(fixture, 'calls.txt')
    fs.mkdirSync(path.join(fixture, 'candidate/client/travel-books'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'candidate/client/travel-books/manifest.json'), '{}'.padEnd(8 * 1024, ' '))
    fs.mkdirSync(path.join(fixture, 'candidate/client/_expo/static/js/web'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'candidate/client/_expo/static/js/web/entry-a.js'), 'x'.repeat(4096))
    const candidateKib = Number(runCli('du', ['-sk', path.join(fixture, 'candidate')]).stdout.split(/\s+/)[0])
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'b'.repeat(40), path.join(fixture, 'candidate')], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true', SSR_RELEASE_JS_MAX_MB: '700',
        SSR_TEST_CALLS: calls,
        SSR_TEST_CAPABILITY: '{"schema_version":2,"available":true,"enabled":true,"quest_web":{"schema_version":2,"refresh_max_age_seconds":30,"builder_schema":2}}',
      },
    })
    expect(result.status).toBe(0)
    const commands = fs.readFileSync(calls, 'utf8').trim().split('\n')
    const incoming = '/owned/repository/web-ssr/incoming/'+'b'.repeat(40)
    const store = '/owned/repository/web-ssr/shared/travel-books'
    expect(commands.some(command => command.includes(`mkdir -p '${store}'`) || command.includes('--link-dest') || command.includes(' --dry-run '))).toBe(false)
    const preflight = commands.findIndex(command => command.includes('bash -s -- preflight'))
    expect(commands[preflight]).toContain(`/owned/repository ${candidateKib} 720 1536`)
    const transfers = commands.map((command, index) => ({ command, index })).filter(({ command }) => command.startsWith('rsync '))
    expect(transfers).toHaveLength(1)
    expect(transfers[0].index).toBeGreaterThan(preflight)
    expect(transfers[0].command).toBe(`rsync -azHhe ssh --delete --mkpath --protect-args ${path.join(fixture, 'candidate')}/ test@invalid.example:${incoming}/`)
    const stage = commands.findIndex(command => command.includes('stage --sha '+'b'.repeat(40)+' --overlay-retention-days 14 --overlay-max-mb 256'))
    expect(stage).toBeGreaterThan(transfers[0].index)
    const books = commands.findIndex(command => command.includes(`bash -s -- books /owned/repository/web-ssr/releases/${'b'.repeat(40)}/client ${store}`))
    expect(books).toBeGreaterThan(stage)
    const chunks = commands.findIndex(command => command.includes('bash -s -- chunks '))
    expect(chunks).toBeGreaterThan(books)
    expect(commands[chunks]).toContain(`bash -s -- chunks /owned/repository/web-ssr/releases/${'b'.repeat(40)}/client 4 256 700`)
  })

  it('real final client packaging preserves linked publication inodes in a separate fresh candidate', () => {
    const source = fs.readFileSync(path.resolve('build-prod.sh'), 'utf8')
    const start = source.indexOf('if [[ "$SSR_CODE_RELEASE" == "1" ]]; then\n  # Publish the finished shell metadata')
    const end = source.indexOf('\nfi', start)
    if(start < 0 || end < 0)throw new Error('Final SSR client packaging block missing')
    const original = path.join(fixture, 'dist/prod/travel-books')
    const first = path.join(original, 'book/r1/read.pdf')
    const duplicate = path.join(original, 'book/r2/read.pdf')
    const distinct = path.join(original, 'book/r2/other.pdf')
    const bytes = Buffer.from('%PDF-'+'body'.repeat(65536))
    fs.mkdirSync(path.dirname(first), {recursive:true})
    fs.mkdirSync(path.dirname(duplicate), {recursive:true})
    fs.writeFileSync(first, bytes)
    fs.linkSync(first, duplicate)
    fs.writeFileSync(distinct, 'other bytes')
    const target = path.join(fixture, 'candidate/client')
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'stale.html'), 'old candidate')
    const result = runCli('/bin/bash', ['-c', 'set -euo pipefail\n'+source.slice(start,end+3)], {
      cwd: fixture, env: {ENV:'prod',SSR_CODE_RELEASE:'1',SSR_RELEASE_DIR:path.join(fixture,'candidate')},
    })
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(target,'stale.html'))).toBe(false)
    const copiedFirst = path.join(target,'travel-books/book/r1/read.pdf')
    const copiedDuplicate = path.join(target,'travel-books/book/r2/read.pdf')
    const a = fs.statSync(copiedFirst), b = fs.statSync(copiedDuplicate)
    expect([a.dev,a.ino]).toEqual([b.dev,b.ino])
    expect(a.nlink).toBe(2)
    expect(a.ino).not.toBe(fs.statSync(first).ino)
    expect(fs.statSync(path.join(target,'travel-books/book/r2/other.pdf')).ino).not.toBe(a.ino)
    expect(fs.readFileSync(copiedFirst)).toEqual(bytes)
    expect(fs.readFileSync(copiedDuplicate)).toEqual(bytes)
    expect(a.blocks).toBeGreaterThan(0)
  })
})
