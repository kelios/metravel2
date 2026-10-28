export type WebMapTestRuntime<T> = typeof import('@testing-library/react/pure') & {
  subject: T
  matchers: typeof import('@testing-library/jest-dom/matchers')
}

/**
 * DOM runtime for HTML map surfaces.
 *
 * `setup.ts` installs one `react-native` mock for the whole file. Jest 30
 * keeps that instance across `isolateModules`, so a later `doMock` factory
 * never runs and the subject still renders host `<view testid>`. Resetting
 * the module registry lets this load bind react-native-web, while modules
 * already evaluated by the test file keep the native mock they closed over.
 */
export function createWebMapTestRuntime<T>(
  React: typeof import('react'),
  loadSubject: () => T,
  options: {
    sharedModules?: Record<string, unknown>
    observeViewProps?: (props: Record<string, any>) => void
  } = {},
): WebMapTestRuntime<T> {
  const native = require('react-native')
  const nativeFeather = require('@expo/vector-icons/Feather')
  const previousReact = require('react')
  const reanimated = require('react-native-reanimated')
  const worklets = require('react-native-worklets')
  const reactQuery = require('@tanstack/react-query')

  jest.resetModules()
  jest.doMock('react', () => React)
  jest.doMock('react-native-reanimated', () => reanimated)
  jest.doMock('react-native-worklets', () => worklets)
  jest.doMock('@tanstack/react-query', () => reactQuery)
  jest.doMock('react-native', () => {
    const web = jest.requireActual('react-native-web')
    if (!options.observeViewProps) return web
    return {
      ...web,
      View: React.forwardRef((props: any, ref: any) => {
        options.observeViewProps?.(props)
        return React.createElement(web.View, { ...props, ref })
      }),
    }
  })
  jest.doMock('@expo/vector-icons/Feather', () => ({
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement('span', {
      'aria-hidden': true,
      'data-icon': name,
    }),
  }))
  for (const [id, module] of Object.entries(options.sharedModules ?? {})) {
    jest.doMock(id, () => module)
  }

  let runtime: WebMapTestRuntime<T> | undefined
  try {
    const dom = require('@testing-library/react/pure')
    runtime = {
      ...dom,
      subject: loadSubject(),
      matchers: require('@testing-library/jest-dom/matchers'),
    }
  } finally {
    // Later requires in this file (native halves, already-imported modules
    // that load a sibling) get the pre-reset native mock back only after
    // another reset. Put the factory back so that reset does.
    jest.doMock('react-native', () => native)
    jest.doMock('@expo/vector-icons/Feather', () => nativeFeather)
    jest.doMock('react', () => previousReact)
  }
  if (!runtime) throw new Error('Web map runtime did not initialize')
  return runtime
}
