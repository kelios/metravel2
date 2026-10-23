/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

it('hydrates denied numeric editor documents through the real root web navigator', () => {
  const directory = path.resolve('.codex-temp/2701')
  fs.mkdirSync(directory, { recursive: true })
  const child = spawnSync(process.execPath, [
    path.resolve('node_modules/jest/bin/jest.js'),
    '--config', '__tests__/app/deniedEditorDocument/config.cjs', '--runInBand', '--watchAll=false',
  ], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 45_000, maxBuffer: 5 * 1024 * 1024 })
  const evidence = path.join(directory, 'document-ssr-hydration.log')
  fs.writeFileSync(evidence, `${child.stdout ?? ''}\n${child.stderr ?? ''}`)
  if (child.error || child.status !== 0) throw new Error(`Denied document web fixture failed (${child.status}); ${evidence}\n${child.error?.message ?? ''}\n${child.stdout ?? ''}\n${child.stderr ?? ''}`)
}, 50_000)
