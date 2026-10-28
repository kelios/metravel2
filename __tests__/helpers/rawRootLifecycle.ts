import { act } from 'react'
import { createRoot, type Root, type RootOptions } from 'test-renderer'

/** Own raw renderer roots, including roots whose render call discards the handle. */
export function createRootRegistry() {
  const roots = new Set<Root>()
  return {
    createRoot(options?: RootOptions): Root {
      const root = createRoot(options)
      roots.add(root)
      return root
    },
    async cleanup(): Promise<void> {
      for (const root of roots) {
        await act(() => root.unmount())
        roots.delete(root)
      }
    },
  }
}
