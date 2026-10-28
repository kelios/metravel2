import React, { useEffect } from 'react'
import { createRootRegistry } from './rawRootLifecycle'

it('disposes every real raw root before suite state is restored, including discarded handles', async () => {
  const registry = createRootRegistry()
  const mounted = new Set<string>()
  const disposed: string[] = []
  let suiteState = 'active'
  function Probe({ id }: { id: string }) {
    useEffect(() => {
      mounted.add(id)
      return () => {
        mounted.delete(id)
        disposed.push(`${id}:${suiteState}`)
      }
    }, [id])
    return <section />
  }

  try {
    await registry.cleanup()
    const first = registry.createRoot()
    const second = registry.createRoot()
    await React.act(() => {
      first.render(<Probe id="first" />)
      second.render(<Probe id="second" />)
      registry.createRoot().render(<Probe id="discarded" />)
    })
    expect(mounted).toEqual(new Set(['first', 'second', 'discarded']))
    expect(first.container.queryAll(node => node.type === 'section')).toHaveLength(1)

    await registry.cleanup()
    suiteState = 'restored'
    expect(mounted.size).toBe(0)
    expect(disposed).toEqual(['first:active', 'second:active', 'discarded:active'])
    await registry.cleanup()
    expect(disposed).toHaveLength(3)
  } finally {
    await registry.cleanup()
  }
})
