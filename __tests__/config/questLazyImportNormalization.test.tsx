import fs from 'node:fs'
import path from 'node:path'
import { transformSync } from '@babel/core'
import React from 'react'
import { Text } from 'react-native'
import { act, render, renderHook, waitFor } from '@testing-library/react-native'

// Execute the real caller with only its import transport substituted: Metro may
// return an ordinary module or a thenable lacking catch/finally.
function loadCaller<T>(file: string, loadImport: () => unknown, overrides: Record<string, unknown> = {}): T {
  const filename = path.resolve(__dirname, '../..', file)
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    plugins: [
      () => ({ visitor: { CallExpression(nodePath: any) {
        if (nodePath.node.callee.type === 'Import') {
          nodePath.replaceWith({ type: 'CallExpression', callee: { type: 'Identifier', name: 'loadImport' }, arguments: [] })
        }
      } } }),
      '@babel/plugin-transform-typescript',
      '@babel/plugin-transform-modules-commonjs',
    ],
  })!.code!
  const module = { exports: {} }
  const loadDependency = (specifier: string) => specifier === 'react' ? React : overrides[specifier] ?? require(specifier)
  new Function('require', 'module', 'exports', 'loadImport', code)(loadDependency, module, module.exports, loadImport)
  return module.exports as T
}

const asThenable = (module: unknown) => ({ then: (resolve: (value: unknown) => void) => resolve(module) })
const shapes = [
  ['plain module', (module: unknown) => module],
  ['thenable with only then', asThenable],
] as const

it.each(shapes)('review prompt keeps success and dismissal with %s', async (_name, wrap) => {
  const prompt = { questId: 'quest', cityId: 'city', cityName: 'City' }
  const claimQuestReviewPrompt = jest.fn().mockResolvedValue(prompt)
  const loadImport = jest.fn(() => wrap({ claimQuestReviewPrompt }))
  const { useQuestReviewPrompt } = loadCaller<typeof import('@/hooks/useQuestReviewPrompt')>(
    'hooks/useQuestReviewPrompt.ts', loadImport,
    { '@/stores/authStore': { useAuthStore: (select: (state: { userId: number }) => unknown) => select({ userId: 7 }) },
      '@/utils/questReturnVisit': { questRetentionOwnerId: () => 'user:7' } },
  )
  const { result } = await renderHook(() => useQuestReviewPrompt())
  await waitFor(() => expect(result.current.prompt).toEqual(prompt))
  expect(claimQuestReviewPrompt).toHaveBeenCalledWith('user:7', expect.any(Function))
  expect(loadImport).toHaveBeenCalledTimes(1)
  await act(() => result.current.dismiss())
  expect(result.current.prompt).toBeNull()
})

it.each(shapes)('catalog engine keeps search and cache with %s', async (_name, wrap) => {
  const matches = [{ id: 'found' }]
  const search = jest.fn(() => ({ quests: matches, approximate: false }))
  const runtime = { createQuestCatalogSearch: jest.fn(() => search) }
  const loadImport = jest.fn(() => wrap(runtime))
  const { useQuestCatalogSearchResult } = loadCaller<typeof import('@/screens/tabs/useQuestCatalogEngines')>(
    'screens/tabs/useQuestCatalogEngines.ts', loadImport,
  )
  const quests: never[] = []
  const { result, rerender } = await renderHook(() => useQuestCatalogSearchResult(quests, {}, 'city', true))
  await waitFor(() => expect(result.current).toEqual({ quests: matches, approximate: false, pending: false }))
  await rerender({})
  expect(loadImport).toHaveBeenCalledTimes(1)
  expect(search).toHaveBeenCalledWith('city')
})

it.each(['rejected promise', 'synchronous throw'])('catalog retries a %s and caches the recovered module', async (shape) => {
  jest.useFakeTimers()
  try {
    const runtime = { createQuestCatalogSearch: () => () => ({ quests: [], approximate: false }) }
    const loadImport = jest.fn().mockImplementationOnce(() => {
      if (shape === 'synchronous throw') throw new Error('chunk failed')
      return Promise.reject(new Error('chunk failed'))
    }).mockReturnValue(runtime)
    const { useQuestCatalogSearchResult } = loadCaller<typeof import('@/screens/tabs/useQuestCatalogEngines')>(
      'screens/tabs/useQuestCatalogEngines.ts', loadImport,
    )
    const quests: never[] = []
    const { result, rerender } = await renderHook(() => useQuestCatalogSearchResult(quests, {}, 'city', true))
    expect(result.current?.pending).toBe(true)
    expect(loadImport).toHaveBeenCalledTimes(1)
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    expect(result.current?.pending).toBe(false)
    await rerender({})
    expect(loadImport).toHaveBeenCalledTimes(2)
  } finally {
    jest.useRealTimers()
  }
})

it.each(['rejected promise', 'synchronous throw'])('review prompt suppresses a %s without publishing a prompt', async (shape) => {
  const loadImport = jest.fn(() => {
    if (shape === 'synchronous throw') throw new Error('chunk failed')
    return Promise.reject(new Error('chunk failed'))
  })
  const { useQuestReviewPrompt } = loadCaller<typeof import('@/hooks/useQuestReviewPrompt')>(
    'hooks/useQuestReviewPrompt.ts', loadImport,
    { '@/stores/authStore': { useAuthStore: (select: (state: { userId: number }) => unknown) => select({ userId: 7 }) },
      '@/utils/questReturnVisit': { questRetentionOwnerId: () => 'user:7' } },
  )
  const { result, rerender } = await renderHook(() => useQuestReviewPrompt())
  await act(async () => { await Promise.resolve() })
  expect(result.current.prompt).toBeNull()
  await rerender({})
  expect(loadImport).toHaveBeenCalledTimes(1)
})

const originalPicksFlag = process.env.EXPO_PUBLIC_AI_PICKS
const originalAssistantFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
afterEach(() => {
  if (originalPicksFlag === undefined) delete process.env.EXPO_PUBLIC_AI_PICKS
  else process.env.EXPO_PUBLIC_AI_PICKS = originalPicksFlag
  if (originalAssistantFlag === undefined) delete process.env.EXPO_PUBLIC_AI_ASSISTANT
  else process.env.EXPO_PUBLIC_AI_ASSISTANT = originalAssistantFlag
})

it('keeps the near-route feature unloaded with picks disabled', async () => {
  delete process.env.EXPO_PUBLIC_AI_PICKS
  const loadImport = jest.fn()
  const { default: Component } = loadCaller<typeof import('@/components/trips/planning/RouteNearSuggestions')>(
    'components/trips/planning/RouteNearSuggestions.tsx', loadImport,
  )
  const screen = await render(<React.Suspense fallback={null}><Component route={[]} onAddPoint={jest.fn()} /></React.Suspense>)
  expect(screen.toJSON()).toBeNull()
  expect(loadImport).not.toHaveBeenCalled()
})

it('uses the caller Suspense while the enabled near-route chunk loads and keeps its mounted runtime stable', async () => {
  process.env.EXPO_PUBLIC_AI_PICKS = '1'
  let finish: (module: unknown) => void = () => {}
  const loadImport = jest.fn(() => new Promise(resolve => { finish = resolve }))
  const runtime = jest.fn(() => <Text testID="near-runtime">Loaded</Text>)
  const { default: Component } = loadCaller<typeof import('@/components/trips/planning/RouteNearSuggestions')>(
    'components/trips/planning/RouteNearSuggestions.tsx', loadImport,
  )
  const screen = await render(<React.Suspense fallback={null}><Component route={[]} onAddPoint={jest.fn()} /></React.Suspense>)
  expect(loadImport).toHaveBeenCalledTimes(1)
  expect(screen.toJSON()).toBeNull()
  await act(async () => { finish({ default: runtime }) })
  expect(screen.getByTestId('near-runtime')).toBeTruthy()
  await screen.rerender(<React.Suspense fallback={null}><Component route={[]} onAddPoint={jest.fn()} /></React.Suspense>)
  expect(loadImport).toHaveBeenCalledTimes(1)
  expect(runtime).toHaveBeenCalledTimes(2)
})

class ImportErrorBoundary extends React.Component<React.PropsWithChildren<{ onError: (error: Error) => void }>, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { this.props.onError(error) }
  render() { return this.state.failed ? null : this.props.children }
}

it('propagates a rejected near-route chunk to the caller error boundary', async () => {
  process.env.EXPO_PUBLIC_AI_PICKS = '1'
  const failure = new Error('near-route chunk failed')
  const onError = jest.fn()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  const { default: Component } = loadCaller<typeof import('@/components/trips/planning/RouteNearSuggestions')>(
    'components/trips/planning/RouteNearSuggestions.tsx', () => Promise.reject(failure),
  )
  await render(<ImportErrorBoundary onError={onError}><React.Suspense fallback={null}><Component route={[]} onAddPoint={jest.fn()} /></React.Suspense></ImportErrorBoundary>)
  await waitFor(() => expect(onError).toHaveBeenCalledWith(failure))
})

it('does not start the author request after unmount while its module is loading', async () => {
  process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
  let finish: (module: unknown) => void = () => {}
  const requestAuthorDraft = jest.fn()
  const { useAuthorDraft } = loadCaller<typeof import('@/components/travel/upsert/useAuthorDraft')>(
    'components/travel/upsert/useAuthorDraft.ts', () => new Promise(resolve => { finish = resolve }),
    { '@/i18n': { getActiveLocale: () => 'pl' }, '@/utils/aiPicksConfig': { getAiPicksBaseUrl: () => '' } },
  )
  const { result, unmount } = await renderHook(() => useAuthorDraft('description'))
  let pending: Promise<void> | undefined
  await act(async () => { pending = result.current.suggest('title') })
  await unmount()
  await act(async () => { finish({ requestAuthorDraft }); await pending })
  expect(requestAuthorDraft).not.toHaveBeenCalled()
})
