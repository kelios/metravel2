import fs from 'node:fs'

const files: typeof import('node:fs/promises') = require('node:fs/promises')

/** Graph unit tests exercise real private files; fsync contracts have dedicated tests. */
export function mockWorkerDurability(): void {
  jest.spyOn(fs, 'fsyncSync').mockImplementation(() => undefined)
  const open = files.open
  jest.spyOn(files, 'open').mockImplementation(async (...args: Parameters<typeof files.open>) => {
    const handle = await open(...args)
    jest.spyOn(handle, 'sync').mockResolvedValue(undefined)
    return handle
  })
}
