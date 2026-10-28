import React from 'react'
import { createRoot } from 'test-renderer'
import { getAllHosts, getOnlyHost, queryHost } from './hostQueries'

it('queries actual hosts strictly and excludes the pseudo-container', async () => {
  const root = createRoot()
  const matches = (kind: string) => (node: { props: Record<string, unknown> }) => node.props.kind === kind
  try {
    await React.act(() => root.render(React.createElement('section', { kind: 'single' },
      React.createElement('span', { kind: 'duplicate' }),
      React.createElement('span', { kind: 'duplicate' }),
    )))
    const section = getOnlyHost(root.container, matches('single'))
    expect(queryHost(root.container, matches('single'))).toBe(section)
    expect(getOnlyHost(section, matches('single'))).toBe(section)
    expect(getAllHosts(root.container, matches('duplicate'))).toHaveLength(2)
    expect(getAllHosts(root.container, () => true)).toHaveLength(3)
    expect(queryHost(root.container, matches('none'))).toBeNull()
    expect(() => getOnlyHost(root.container, matches('none'))).toThrow('found 0')
    expect(() => getAllHosts(root.container, matches('none'))).toThrow('found 0')
    expect(() => getOnlyHost(root.container, matches('duplicate'))).toThrow('found 2')
    expect(() => queryHost(root.container, matches('duplicate'))).toThrow('found 2')
  } finally {
    await React.act(() => root.unmount())
  }
})
