import React from 'react'

const EmptyFallback = () => null

const safeLazy = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  name?: string,
) =>
  React.lazy(() =>
    Promise.resolve(loader()).catch((err) => {
      if (__DEV__) console.error(`[safeLazy] Failed to load ${name || 'component'}:`, err)
      return { default: EmptyFallback as unknown as T }
    }),
  )

export const SyncIndicatorComponent: React.ComponentType<any> | null = null
export const ToastComponent: React.ComponentType<any> | null = null
export const NativeFooterComponent: React.ComponentType<any> | null = null

export const ReactQueryDevtoolsComponent: any = __DEV__
  ? safeLazy(
      () =>
        Promise.resolve(import('@tanstack/react-query-devtools')).then((m: any) => ({
          default: m.ReactQueryDevtools,
        })),
      'ReactQueryDevtools',
    )
  : null

export const RootWebDeferredChromeComponent: React.ComponentType<any> | null = safeLazy(
  () => import('@/components/layout/RootWebDeferredChrome'),
  'RootWebDeferredChrome',
)
