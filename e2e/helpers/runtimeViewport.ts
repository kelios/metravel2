/** Explicit acceptance scope, without changing the default project matrix. */
export function runtimeViewport(defaultViewport: { width: number; height: number }): { width: number; height: number } {
  return process.env.E2E_RUNTIME_MOBILE_ONLY === '1'
    ? { width: 390, height: 844 }
    : defaultViewport
}
