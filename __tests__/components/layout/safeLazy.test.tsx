import React from 'react'
import { Text } from 'react-native'

import { createResilientLoader, safeLazy } from '@/components/layout/safeLazy'

const Nav = () => <Text testID="nav">nav</Text>

describe('createResilientLoader', () => {
  it('resolves to the module when the import succeeds', async () => {
    const loader = jest.fn(async () => ({ default: Nav }))
    const resolved = await createResilientLoader(loader)()
    expect(resolved.default).toBe(Nav)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('recovers from a transient reject via retry', async () => {
    let calls = 0
    const loader = jest.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('transient chunk error')
      return { default: Nav }
    })
    const resolved = await createResilientLoader(loader, 'CustomHeaderNavSection', { retries: 2 })()
    expect(resolved.default).toBe(Nav)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('resolves to a fallback (never rejects) when the import keeps failing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const loader = jest.fn(async () => {
      throw new Error('permanent chunk error')
    })
    // initial attempt + 2 retries = 3 calls, then resolves to a fallback module — no throw.
    const resolved = await createResilientLoader(loader, 'CustomHeaderNavSection', { retries: 2 })()
    expect(loader).toHaveBeenCalledTimes(3)
    expect(typeof resolved.default).toBe('function')
    expect(resolved.default).not.toBe(Nav)
    errorSpy.mockRestore()
  })

  it('uses a custom fallback component when provided', async () => {
    const Fallback = () => <Text>fallback</Text>
    const loader = jest.fn(async () => {
      throw new Error('fail')
    })
    const resolved = await createResilientLoader(loader, 'x', { fallback: Fallback })()
    expect(resolved.default).toBe(Fallback)
  })
})

describe('safeLazy', () => {
  it('returns a React.lazy component (lazy exotic type)', () => {
    const Comp = safeLazy(async () => ({ default: Nav }))
    expect((Comp as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for('react.lazy'))
  })
})
