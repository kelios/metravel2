/**
 * #3209: production has one publisher, and the emergency path is made of its
 * operations.
 *
 * `scripts/fix-prod.sh` was a second implementation of the publication with
 * its own rsync into the backend checkout. It fell behind the normal path five
 * times (#733, #653, #1883, #2226, and the SSR releases of #2766): after #2766
 * it uploaded `dist/`, `icons/` and `images/`, was refused by the host, left
 * the directories behind, and the next normal deploy stopped on a dirty
 * production checkout. The script is gone; this suite turns red when a second
 * upload path appears, when the runbook names a command that does not exist,
 * or when a documented setting is outside the bounds the backend accepts.
 */
import fs from 'fs'
import path from 'path'

import { runCli } from './cli-test-utils'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const RUNBOOK = 'docs/WORKFLOW_OPERATIONS.md'
const RUNBOOK_HEADING = '#### Аварийный возврат прошлой версии'
const PUBLISHER = 'scripts/web-ssr-publication.sh'

function shellScripts(): string[] {
  const found = ['build-prod.sh']
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(relative)
      else if (entry.name.endsWith('.sh')) found.push(relative)
    }
  }
  walk('scripts')
  return found
}

// Commands with their continuation lines joined; comments and blank lines dropped.
function commands(source: string): string[] {
  return source
    .replace(/\\\n\s*/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

const REMOTE_COPY = /(^|[\s;&|(])(rsync|scp)\s/
const REMOTE_TARGET = /\$\{?(PROD_SSH_TARGET|SERVER|PROD_SSH_HOST)\}?[^\s]*:|\bssh\b/

function runbookSection(): string {
  const source = read(RUNBOOK)
  const start = source.indexOf(RUNBOOK_HEADING)
  const end = source.indexOf('\n### ', start)
  if (start === -1 || end === -1) throw new Error(`${RUNBOOK}: раздел «Аварийный возврат прошлой версии» не найден`)
  return source.slice(start, end)
}

function publisherActions(): string[] {
  const source = read(PUBLISHER)
  const labels = [...source.matchAll(/^\s+([a-z|-]+)\)\s*$/gm)].flatMap((match) => match[1].split('|'))
  return ['capability', ...labels]
}

describe('emergency recovery uses the one publisher (#3209)', () => {
  it('has no separate emergency publication script', () => {
    expect(fs.existsSync(path.join(root, 'scripts/fix-prod.sh'))).toBe(false)
    expect(read('package.json')).not.toContain('fix-prod')
  })

  it('uploads to the production host from exactly one place: the release stage', () => {
    const uploads = shellScripts().flatMap((file) =>
      commands(read(file))
        .filter((command) => REMOTE_COPY.test(command) && REMOTE_TARGET.test(command))
        .map((command) => ({ file, command })),
    )

    expect(uploads).toHaveLength(1)
    expect(uploads[0].file).toBe(PUBLISHER)
    // Into the private incoming directory of the release protocol, never into
    // a tracked path of the backend checkout or the served static root.
    expect(uploads[0].command).toContain('"$PROD_SSH_TARGET:$incoming/"')
    expect(read(PUBLISHER)).toContain('incoming="$PROD_REMOTE_DIR/web-ssr/incoming/$sha"')
  })

  it('documents a runbook whose every command exists', () => {
    const section = runbookSection()
    const blocks = [...section.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1].trim())
    expect(blocks.length).toBeGreaterThanOrEqual(5)

    const scripts = new Set([...section.matchAll(/scripts\/[\w./-]+\.(?:sh|js)/g)].map((match) => match[0]))
    // The only script the section may name without it existing is the removed one.
    scripts.delete('scripts/fix-prod.sh')
    expect(scripts.size).toBeGreaterThanOrEqual(4)
    for (const script of scripts) {
      expect({ script, exists: fs.existsSync(path.join(root, script)) }).toEqual({ script, exists: true })
    }

    const actions = publisherActions()
    const used = [...section.matchAll(/web-ssr-publication\.sh\s+([a-z-]+)/g)].map((match) => match[1])
    expect(used).toEqual(expect.arrayContaining(['capability', 'rollback-code']))
    for (const action of used) expect(actions).toContain(action)

    // Each block is one command line: the app puts a Run button on it.
    for (const block of blocks) expect(block.split('\n')).toHaveLength(1)
  })

  it('names only rollback levers that the scripts implement', () => {
    const section = runbookSection()

    expect(section).toContain('ALLOW_DOWNGRADE=1 DEPLOY_QUIET=1 scripts/deploy-prod.sh')
    expect(read('scripts/assert-deployable-source.js')).toContain("process.env.ALLOW_DOWNGRADE === '1'")
    expect(read('scripts/deploy-prod.sh')).toContain('--live-check-only "$SHA"')
    // The accepted-release rollback is a backend operation: the frontend
    // publisher must not grow a flag that reverts an accepted release.
    expect(section).toContain('rollback-code --accepted')
    expect(read(PUBLISHER)).not.toContain('--accepted')
    expect(read('build-prod.sh')).toContain('«Аварийный возврат прошлой версии»')
  })

  it.each([
    'docs/WORKFLOW_OPERATIONS.md',
    'docs/RELEASE.md',
    'docs/PRODUCTION_CHECKLIST.md',
    'docs/ops/quest-locale-release.md',
    '.claude/agents/frontend-deployer.md',
    '.codex/skills/metravel-release-checks/SKILL.md',
  ])('%s does not send anyone to the removed script', (file) => {
    const paragraphs = read(file).split(/\n\s*\n/).filter((paragraph) => paragraph.includes('fix-prod.sh'))
    for (const paragraph of paragraphs) {
      expect(paragraph.replace(/\s+/g, ' ')).toMatch(/удал[её]н|removed in #3209/)
    }
  })
})

describe('deploy settings stay inside the backend release bounds (#3209)', () => {
  const defaults = read('scripts/deploy-target.sh').split('metravel_deploy_defaults() {')[1].split('\n}\n')[0]
  const run = (env: Record<string, string> = {}) =>
    runCli('bash', ['-s'], {
      env: { EXPO_OVERLAY_RETENTION_DAYS: '', EXPO_OVERLAY_MAX_MB: '', DEPLOY_DISK_RESERVE_MB: '', DEPLOY_BACKEND_BUILD_MB: '', ...env },
      input: `
set -euo pipefail
metravel_deploy_defaults() {${defaults}
}
metravel_deploy_defaults
printf '%s/%s/%s/%s' "$EXPO_OVERLAY_RETENTION_DAYS" "$EXPO_OVERLAY_MAX_MB" "$DEPLOY_DISK_RESERVE_MB" "$DEPLOY_BACKEND_BUILD_MB"
`,
    })

  it('shares exact defaults, accepts overrides and keeps the backend build floor fixed', () => {
    expect(run().stdout).toBe('14/256/720/1536')
    expect(run({ EXPO_OVERLAY_RETENTION_DAYS: '1', EXPO_OVERLAY_MAX_MB: '32', DEPLOY_DISK_RESERVE_MB: '900', DEPLOY_BACKEND_BUILD_MB: '1800' }).stdout)
      .toBe('1/32/900/1536')
    expect(run({ EXPO_OVERLAY_RETENTION_DAYS: '90', EXPO_OVERLAY_MAX_MB: '4096' }).stdout).toBe('90/4096/720/1536')
    // The publisher reads them before the first byte is uploaded.
    const publisher = read(PUBLISHER)
    expect(publisher.indexOf('metravel_deploy_defaults')).toBeGreaterThan(-1)
    expect(publisher.indexOf('metravel_deploy_defaults')).toBeLessThan(publisher.indexOf('rsync -azHhe ssh'))
  })

  // metravel-backend deploy/prod/web_ssr_release.py refuses the seal outside
  // 1..90 days and 1..4096 MB — after the upload, unless the frontend stops first.
  it.each([
    { EXPO_OVERLAY_MAX_MB: 'oops' },
    { EXPO_OVERLAY_MAX_MB: '0' },
    { EXPO_OVERLAY_MAX_MB: '4097' },
    { EXPO_OVERLAY_RETENTION_DAYS: '0' },
    { EXPO_OVERLAY_RETENTION_DAYS: '91' },
  ])('refuses %o before any upload', (env) => {
    const result = run(env as Record<string, string>)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(Object.keys(env)[0])
  })

  it('documents only values the deploy accepts', () => {
    const files = ['.env.deploy.example', '.claude/agents/frontend-deployer.md']
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${dir}/${entry.name}`)
        else if (entry.name.endsWith('.md')) files.push(`${dir}/${entry.name}`)
      }
    }
    walk('docs')

    const documented = files.flatMap((file) =>
      [...read(file).matchAll(/\b(EXPO_OVERLAY_MAX_MB|EXPO_OVERLAY_RETENTION_DAYS)=(\d+)\b/g)]
        .map((match) => ({ file, name: match[1], value: match[2] })),
    )

    expect(documented.length).toBeGreaterThan(0)
    for (const setting of documented) {
      expect({ ...setting, accepted: run({ [setting.name]: setting.value }).status === 0 }).toEqual({ ...setting, accepted: true })
    }
  })
})
