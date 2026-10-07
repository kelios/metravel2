/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/**
 * A fresh child runtime is necessary: the native suite mocks Head/CoreModule,
 * and cached React.lazy payloads cannot establish a cold-render invariant.
 * Both children keep the real route/catalog/providers and inherit the current
 * quality-gate lock. Node emits the actual HTML subsequently hydrated in jsdom.
 * Exact ExpoRoot/Metro export and live-account flows remain testing gates.
 */
it('renders a cold real catalog and hydrates its states without recovery', () => {
  const scratch = path.resolve(process.cwd(), '.codex-temp')
  fs.mkdirSync(scratch, { recursive: true })
  const output = fs.mkdtempSync(path.join(scratch, 'trips-cold-render-'))
  for (const environment of ['node', 'jsdom']) {
    const child = spawnSync(process.execPath, [
      path.resolve('node_modules/jest/bin/jest.js'),
      '--config', '__tests__/app/tripsStaticRender/config.cjs',
      `--env=${environment}`, '--runInBand', '--watchAll=false',
    ], {
      cwd: process.cwd(),
      env: { ...process.env, TRIPS_COLD_RENDER_DIR: output },
      encoding: 'utf8',
      timeout: 45_000,
      maxBuffer: 5 * 1024 * 1024,
    })
    fs.writeFileSync(path.join(output, `${environment}.log`), `${child.stdout ?? ''}\n${child.stderr ?? ''}`)
    if (child.error || child.status !== 0) {
      throw new Error(`Real trips ${environment} fixture failed (${child.status}); raw evidence: ${output}\n${child.error?.message ?? ''}\n${child.stdout ?? ''}\n${child.stderr ?? ''}`)
    }
    const report = JSON.parse(fs.readFileSync(path.join(output, `${environment}.json`), 'utf8'))
    expect(report.serverFetches).toBe(0)
    expect(report.failedBoundaries).toBe(0)
    expect(report.catalog).toBe(true)
    expect(report.loading).toBe(true)
    expect(report.console.filter((event: { level: string }) => event.level === 'error')).toEqual([])
    if (environment === 'jsdom') {
      expect(report.hydrationErrors).toEqual([])
      expect(report.states).toEqual(['loading', 'populated', 'filtered-empty', 'reset', 'empty', 'error', 'recovery'])
      expect(report.locales).toEqual(['ru', 'be', 'uk', 'pl', 'en'])
    }
  }
}, 100_000)
