/** @jest-environment node */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import fs from 'node:fs'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'
import { PlanningPhysicalSession, planningIdentity } from '@/workers/book-renderer/planningSession'
import { createPlanningPorts } from '@/workers/book-renderer/planningPorts'
import { preparePlanningStep } from '@/workers/book-renderer/planningStep'
import { PlanningStorage } from '@/workers/book-renderer/planningStorage'
import * as measurement from '@/workers/book-renderer/measurement'
import type { PhysicalMeasurer } from '@/workers/book-renderer/measurement'

const RENDERER = 'a'.repeat(64)
const LIMITS = { input_bytes: 257, output_bytes: 4_194_304, output_records: 24, probes: 1 }

describe('job-bound lazy physical planning session', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests'); await mkdir(base, { recursive: true })
    root = await mkdtemp(path.join(base, 'planning-session-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })
  async function setup() {
    const f = await buildSnapshotFixture(path.join(root, 'input'), { travels: [{ id: 93, title: 'Session', cover: false }] })
    const plan = path.join(root, 'plan')
    const session = new PlanningPhysicalSession(f.jobDir, plan, f.document, RENDERER, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE)
    return { ...f, plan, session }
  }

  it('creates one measurer lazily, shares an in-flight launch and closes once at the job boundary', async () => {
    const close = jest.fn(async () => undefined)
    // This lifecycle fixture has no rendering methods: this suite never probes pages.
    const physical = { close } as unknown as PhysicalMeasurer
    let resolveLaunch!: (value: PhysicalMeasurer) => void
    const pending = new Promise<PhysicalMeasurer>(resolve => { resolveLaunch = resolve })
    const launch = jest.spyOn(measurement, 'physicalMeasurer').mockReturnValue(pending)
    const f = await setup()
    expect(launch).not.toHaveBeenCalled()
    const first = f.session.get(); const second = f.session.get()
    expect(launch).toHaveBeenCalledTimes(1)
    resolveLaunch(physical)
    expect(await first).toBe(physical); expect(await second).toBe(physical)
    expect(await f.session.get()).toBe(physical)
    expect(launch).toHaveBeenCalledTimes(1)
    expect(launch.mock.calls[0].slice(0, 2)).toEqual([f.jobDir, f.plan])
    expect(launch.mock.calls[0].slice(3)).toEqual([measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, 5])
    await f.session.close(); await f.session.close()
    expect(close).toHaveBeenCalledTimes(1)
    await expect(f.session.get()).rejects.toThrow('WORKER_PLANNING_SESSION_CLOSED')
  })

  it('does not start a measurer when an unused session is closed', async () => {
    const launch = jest.spyOn(measurement, 'physicalMeasurer').mockRejectedValue(new Error('NO_LAUNCH'))
    const f = await setup(); await f.session.close()
    expect(launch).not.toHaveBeenCalled()
    await expect(f.session.get()).rejects.toThrow('WORKER_PLANNING_SESSION_CLOSED')
  })

  it('retains a copied physical profile despite external mutation of the constructor object', async () => {
    const close = jest.fn(async () => undefined)
    const launch = jest.spyOn(measurement, 'physicalMeasurer').mockResolvedValue({ close } as unknown as PhysicalMeasurer)
    const f = await setup(); const profile = { ...measurement.DEFAULT_RENDERER_RESOURCE_PROFILE }
    const session = new PlanningPhysicalSession(f.jobDir, f.plan, f.document, RENDERER, profile)
    const identity = session.identity; profile.dom_nodes++
    await session.get()
    expect(session.identity).toBe(identity)
    expect(launch.mock.calls[0][3]).toEqual(measurement.DEFAULT_RENDERER_RESOURCE_PROFILE)
    await session.close()
  })

  it('keeps a borrowed session alive when separate generation ports close', async () => {
    const close = jest.fn(async () => undefined)
    jest.spyOn(measurement, 'physicalMeasurer').mockResolvedValue({ close } as unknown as PhysicalMeasurer)
    const f = await setup(); await mkdir(f.plan, { mode: 0o700 })
    await f.session.get()
    for (let generation = 0; generation < 2; generation++) {
      const storage = new PlanningStorage(f.plan, LIMITS)
      const ports = await createPlanningPorts(f.jobDir, storage, f.document, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, undefined, () => null, f.session)
      await ports.close()
      expect(close).not.toHaveBeenCalled()
    }
    await f.session.close()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('rejects another artifact, document, profile or job root before lookup, launch or filesystem publication', async () => {
    const launch = jest.spyOn(measurement, 'physicalMeasurer').mockRejectedValue(new Error('NO_LAUNCH'))
    const lookup = jest.fn(async () => null)
    const f = await setup()
    const request = { renderer_content_hash: RENDERER, generation: 1 }
    const options = { committed: lookup, committed_parser: () => null, physical_session: f.session }
    await expect(preparePlanningStep(f.jobDir, f.plan, f.document, { ...request, renderer_content_hash: 'b'.repeat(64) }, options)).rejects.toThrow('WORKER_PLANNING_SESSION_MISMATCH')
    await expect(preparePlanningStep(f.jobDir, f.plan, { ...f.document, seed: 'other' }, request, options)).rejects.toThrow('WORKER_PLANNING_SESSION_MISMATCH')
    await expect(preparePlanningStep(f.jobDir, f.plan, f.document, { ...request, resource_profile: { ...measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, dom_nodes: 1234 } }, options)).rejects.toThrow('WORKER_PLANNING_SESSION_MISMATCH')
    await expect(preparePlanningStep(path.join(root, 'another-job'), f.plan, f.document, request, options)).rejects.toThrow('WORKER_PLANNING_SESSION_MISMATCH')
    await expect(preparePlanningStep(f.jobDir, path.join(root, 'another-plan'), f.document, request, options)).rejects.toThrow('WORKER_PLANNING_SESSION_MISMATCH')
    expect(lookup).not.toHaveBeenCalled(); expect(launch).not.toHaveBeenCalled()
    expect(fs.existsSync(f.plan)).toBe(false); expect(fs.existsSync(path.join(root, 'another-plan'))).toBe(false)
    await f.session.close()
  })

  it('binds physical and fixture identities separately and normalizes harmless root path spelling', async () => {
    const f = await setup()
    expect(f.session.identity).toBe(planningIdentity(f.document, RENDERER, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, false))
    expect(f.session.identity).not.toBe(planningIdentity(f.document, RENDERER, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, true))
    const alternate = new PlanningPhysicalSession(path.join(f.jobDir, '.'), path.join(f.plan, '.'), f.document, RENDERER, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE)
    expect([alternate.jobRoot, alternate.planRoot, alternate.identity]).toEqual([f.session.jobRoot, f.session.planRoot, f.session.identity])
    await alternate.close(); await f.session.close()
  })
})
