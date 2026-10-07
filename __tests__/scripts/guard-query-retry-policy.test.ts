import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

const { findViolations, collectViolations } = require('../../scripts/guard-query-retry-policy')

it.each([
  'useQuery({ queryKey: ["x"], retry: 2 })',
  'useInfiniteQuery({ retry: (count, error) => count < 2 })',
  'const retry = (count) => count < 2; useQuery({ retry })',
  'const retry = 2; const opts = { retry }; useQuery(opts)',
  'useQueries({ queries: ids.map(id => ({ queryKey: [id], retry: 1 })) })',
  'export const options = () => ({ queryKey: ["factory"], retry: 2 })',
  'const local = common; useQuery({ retry: local })',
  'import { readRetryTwice } from "somewhere-else"; useQuery({ retry: readRetryTwice })',
  'useQuery({ ["queryKey"]: ["x"], ["retry"]: 2 })',
])('rejects noncanonical read options: %s', (source) => {
  expect(findViolations(source, 'hooks/read.ts')).toEqual([expect.objectContaining({ rule: 'noncanonical-query-retry' })])
})

it('accepts only disabled options or actual common imports, including aliases and factories', () => {
  const source = `import { readRetryTwice as two, readRetryAtMost, heavyReadRetry } from '@/utils/queryRetryPolicy';
    useQuery({ retry: false }); useInfiniteQuery({ retry: 0 });
    useQueries({ queries: ids.map(id => ({ queryKey: [id], retry: two })) });
    queryOptions({ retry: readRetryAtMost(1) }); useQuery({ retry: heavyReadRetry.retry });
    useQuery({ ...(offline ? { retry: false } : { retry: two }) });`
  expect(findViolations(source, 'hooks/read.ts')).toEqual([])
})

it('leaves mutations, progress-queue retry and unrelated UI callbacks outside the read-option policy', () => {
  const source = `useMutation({ retry: 2 }); const model = { retry: () => refresh() };
    const queue = { retry: 3 }; const defaults = { mutations: { retry: 1 } };
    useQuery({ queryKey: ['model'], retry: false, queryFn: () => Promise.resolve(model), select: () => ({ retry: () => refresh() }) });`
  expect(findViolations(source, 'hooks/read.ts')).toEqual([])
})

it('empty baseline has no suppression: removing a new numeric override restores the gate', () => {
  const root = makeTempDir('query-retry-guard-')
  try {
    fs.mkdirSync(path.join(root, 'hooks'))
    const file = path.join(root, 'hooks/read.ts')
    const good = "import { readRetryTwice } from '@/utils/queryRetryPolicy'; useQuery({ retry: readRetryTwice })"
    fs.writeFileSync(file, good)
    expect(collectViolations(root)).toEqual([])
    fs.writeFileSync(file, 'useQuery({ retry: 2 })')
    expect(collectViolations(root)).toEqual([expect.objectContaining({ file: 'hooks/read.ts', rule: 'noncanonical-query-retry' })])
    fs.writeFileSync(file, good)
    expect(collectViolations(root)).toEqual([])
  } finally { removeDir(root) }
})

it('actual CLI rejects both newly reintroduced numeric and local-predicate overrides with an empty baseline', () => {
  const root = makeTempDir('query-retry-cli-')
  const script = path.resolve(__dirname, '../../scripts/guard-query-retry-policy.js')
  const run = () => runNodeCli([script], {}, { cwd: root })
  try {
    fs.mkdirSync(path.join(root, 'hooks'))
    const file = path.join(root, 'hooks/read.ts')
    const good = "import { readRetryTwice } from '@/utils/queryRetryPolicy'; useQuery({ retry: readRetryTwice })"
    fs.writeFileSync(file, good)
    expect(run()).toMatchObject({ status: 0, stderr: '' })
    for (const bad of ['useQuery({ retry: 2 })',
      'const retry = (count) => count < 2; useQuery({ retry })']) {
      fs.writeFileSync(file, bad)
      const rejected = run()
      expect(rejected.status).toBe(1)
      expect(rejected.stderr).toContain('noncanonical-query-retry')
    }
    fs.writeFileSync(file, good)
    expect(run()).toMatchObject({ status: 0, stderr: '' })
  } finally { removeDir(root) }
})
