import { Platform } from 'react-native'

// Find a slider DOM node by testID, preferring the instance-scoped match (web only)
export function findSliderNode(
  testId: string,
  instanceId: string,
): HTMLElement | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null
  try {
    const escaped =
      typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(instanceId)
        : instanceId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
    const node = document.querySelector(
      `[data-testid="${testId}"][data-slider-instance="${escaped}"]`,
    ) as HTMLElement | null
    if (node) return node
  } catch {
    /* noop */
  }
  return document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
}
