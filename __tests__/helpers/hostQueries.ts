import type { TestInstance } from 'test-renderer'

type HostPredicate = (node: TestInstance) => boolean

const matchingHosts = (root: TestInstance, predicate: HostPredicate): TestInstance[] =>
  root.queryAll(node => node.type !== '' && predicate(node), { includeSelf: true })

/** Strict host predicate query for raw HTML/geometry props without a semantic query. */
export function queryHost(root: TestInstance, predicate: HostPredicate): TestInstance | null {
  const matches = matchingHosts(root, predicate)
  if (matches.length > 1) throw new Error(`Expected at most one matching host, found ${matches.length}`)
  return matches[0] ?? null
}

export function getOnlyHost(root: TestInstance, predicate: HostPredicate): TestInstance {
  const matches = matchingHosts(root, predicate)
  if (matches.length !== 1) throw new Error(`Expected exactly one matching host, found ${matches.length}`)
  return matches[0]
}

export function getAllHosts(root: TestInstance, predicate: HostPredicate): TestInstance[] {
  const matches = matchingHosts(root, predicate)
  if (matches.length === 0) throw new Error('Expected at least one matching host, found 0')
  return matches
}
