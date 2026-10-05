/**
 * How a flattened RN style resolves to flex-item factors on each engine — so a
 * jest geometry test can catch a layout that only one engine breaks.
 *
 * `StyleSheet.flatten([{ flex: 1 }, { flexGrow: 0, flexBasis: 'auto' }])` keeps
 * all four keys, and the engines disagree on what they mean:
 *
 * - native (Yoga, `useWebDefaults` off) — `flex` is its own prop; an explicit
 *   `flexBasis: 'auto'` counts as unset, so with `flex > 0` the basis is 0
 *   (`react-native/ReactCommon/yoga/yoga/node/Node.cpp`, `processFlexBasis`;
 *   grow/shrink: `resolveFlexGrow` / `resolveFlexShrink`, default shrink 0);
 * - web (react-native-web) — `flex: n` is emitted as the CSS shorthand
 *   (`createReactDOMStyle.js`, `-1` is expanded) in a lower-precedence group
 *   than the atomic longhands (`compiler/index.js` `customGroup.flex = 2`), so
 *   longhands win; CSS defaults: shrink 1 for text.
 */
export type FlexEngine = 'native' | 'web'
export type FlexFactors = { grow: number; shrink: number; basis: number | 'auto' }

type FlexStyle = {
  flex?: number
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number | string
}

const definedBasis = (basis: FlexStyle['flexBasis']): number | 'auto' | undefined =>
  typeof basis === 'number' ? basis : basis === '0%' ? 0 : undefined

export function resolveFlexFactors(style: FlexStyle, engine: FlexEngine, defaultShrink?: number): FlexFactors {
  const { flex, flexGrow, flexShrink, flexBasis } = style
  if (engine === 'native') {
    const basis = definedBasis(flexBasis)
    return {
      grow: flexGrow ?? (flex !== undefined && flex > 0 ? flex : 0),
      shrink: flexShrink ?? (flex !== undefined && flex < 0 ? -flex : defaultShrink ?? 0),
      basis: basis ?? (flex !== undefined && flex > 0 ? 0 : 'auto'),
    }
  }
  const shorthand: FlexFactors | null =
    flex === undefined ? null
      : flex === -1 ? { grow: 0, shrink: 1, basis: 'auto' }
        : { grow: flex, shrink: 1, basis: 0 }
  return {
    grow: flexGrow ?? shorthand?.grow ?? 0,
    shrink: flexShrink ?? shorthand?.shrink ?? defaultShrink ?? 1,
    basis: definedBasis(flexBasis) ?? (flexBasis === 'auto' ? 'auto' : shorthand?.basis ?? 'auto'),
  }
}

/**
 * Main size of the one flexible item of a row whose other items are fixed:
 * `content` is its max-content width, `available` the room the row leaves it.
 * Yoga applies no automatic minimum (min-content) to flex items, so a text
 * with basis 0 and no grow collapses to 0 there.
 */
export function flexItemMainSize(factors: FlexFactors, content: number, available: number): number {
  const basis = factors.basis === 'auto' ? content : factors.basis
  const free = available - basis
  if (free > 0) return basis + (factors.grow > 0 ? free : 0)
  return factors.shrink > 0 ? Math.max(0, available) : basis
}
