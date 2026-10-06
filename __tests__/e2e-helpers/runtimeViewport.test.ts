import { runtimeViewport } from '../../e2e/helpers/runtimeViewport'

const original = process.env.E2E_RUNTIME_MOBILE_ONLY
afterEach(() => {
  if (original === undefined) delete process.env.E2E_RUNTIME_MOBILE_ONLY
  else process.env.E2E_RUNTIME_MOBILE_ONLY = original
})
it('retains existing default viewport and only explicit mobile scope selects 390', () => {
  const desktop = { width: 1280, height: 900 }
  delete process.env.E2E_RUNTIME_MOBILE_ONLY
  expect(runtimeViewport(desktop)).toBe(desktop)
  process.env.E2E_RUNTIME_MOBILE_ONLY = '1'
  expect(runtimeViewport(desktop)).toEqual({ width: 390, height: 844 })
  process.env.E2E_RUNTIME_MOBILE_ONLY = '0'
  expect(runtimeViewport(desktop)).toBe(desktop)
})
