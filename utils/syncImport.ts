/**
 * Module of an `import()` that is already available, or `null`.
 *
 * Metro's web async require evaluates an already registered module at once and
 * hands it over in the returned promise's `_result`
 * (`expo/src/async-require/asyncRequireModule.ts`); `.then` would only deliver
 * it a microtask later — too late for a render that is already running (#2465).
 */
export function readSyncImport<T extends object>(pending: Promise<T>): T | null {
  const result = (pending as Promise<T> & { _result?: unknown })._result
  if (!result || typeof result !== 'object' || typeof (result as { then?: unknown }).then === 'function') return null
  return result as T
}
