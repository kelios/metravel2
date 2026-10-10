import { lstatSync, mkdirSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BookDocument } from '@/types/bookDocument'
import { createDiskCheckpointStores } from './htmlCheckpoint/diskStores'
import { physicalMeasurer, probeFrozenImage, type RendererResourceProfile, type PhysicalMeasurer } from './measurement'
import { canonicalPageQueueProbe } from './planningPageQueue'
import type { BookPlanningPorts } from './planningBookTypes'
import { PlanningStorage } from './planningStorage'
import type { PlanningFile } from './planningTypes'
import type { PlanningPhysicalSession } from './planningSession'

/** A synchronous bounded B3 IPC lookup, scoped to the same committed epoch/head as the async index port. */
export type CommittedParserLookup = (ref: string) => PlanningFile | null
function scopePath(root: string, scope: string, create: boolean): string {
  if (!/^[a-z][a-z0-9-]*(?:\/[a-z0-9.-]+)*$/.test(scope) || scope.length > 256 || scope.split('/').some(part => part === '.' || part === '..')) throw new Error('WORKER_PLANNING_PATH_INVALID')
  let path = resolve(root)
  for (const part of ['', ...scope.split('/')]) {
    if (part) path = resolve(path, part)
    if (create && part) { try { mkdirSync(path, { mode: 0o700 }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error } }
    const info = lstatSync(path)
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o700 || realpathSync(path) !== path) throw new Error('WORKER_PLANNING_DIRECTORY_INVALID')
  }
  return path
}
export async function createPlanningPorts(jobRoot: string, storage: PlanningStorage, pinned: BookDocument,
  profile: RendererResourceProfile, fontsDir: string | undefined, committedParser: CommittedParserLookup,
  session?: PlanningPhysicalSession): Promise<{ ports: BookPlanningPorts; close: () => Promise<void> }> {
  if (typeof committedParser !== 'function') throw new Error('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
  let physical: PhysicalMeasurer | undefined
  const verifyParserRead = (scope: string, actual: PlanningFile): void => {
    const ref = `${scope}/${actual.ref}`
    const expected = committedParser(ref)
    if (!expected || expected.ref !== ref || expected.size_bytes !== actual.size_bytes || expected.checksum !== actual.checksum) throw new Error('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
  }
  return { close: async () => { if (!session) await physical?.close() }, ports: {
    resource_profile: profile,
    imageDimensions: async chunk => ({ ...await probeFrozenImage(jobRoot, chunk, profile, 5), read_bytes: 2 * chunk.size_bytes }),
    read: async (file, maximum) => JSON.parse((await storage.read(file, maximum)).toString('utf8')) as unknown,
    anchor_receipt: committedParser,
    put: (ref, value, maximum) => storage.put(ref, value, maximum),
    admit: (records, bytes) => storage.admit(records, bytes),
    parserStores: scope => createDiskCheckpointStores(scopePath(storage.root, scope, true), {
      onwrite: file => storage.recordExternalReceipt({ ref: `${scope}/${file.ref}`, checksum: file.checksum, size_bytes: file.size_bytes }),
    }),
    parserReadStores: scope => createDiskCheckpointStores(scopePath(storage.root, scope, false), { readonly: true,
      onread: file => verifyParserRead(scope, file),
    }),
    probe: async (source, context) => {
      physical ??= session ? await session.get() : await physicalMeasurer(jobRoot, storage.root, fontsDir ?? resolve(__dirname, '../../fonts'), profile, 5)
      physical.bindPlanning?.(storage)
      return canonicalPageQueueProbe(pinned, physical)(source, context)
    },
  } }
}
