import { goBackOrReplace } from '@/utils/backNavigation'

const makeRouter = (canGoBack: boolean) => ({
  back: jest.fn(),
  canGoBack: jest.fn(() => canGoBack),
  replace: jest.fn(),
  push: jest.fn(),
})

describe('goBackOrReplace', () => {
  it('goes back through real history when it exists (#573)', () => {
    const router = makeRouter(true)
    goBackOrReplace(router as any, '/profile')
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('replaces with the fallback when there is no history (#1725)', () => {
    const router = makeRouter(false)
    goBackOrReplace(router as any, '/profile')
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/profile')
  })

  it('defaults the fallback to the home screen', () => {
    const router = makeRouter(false)
    goBackOrReplace(router as any)
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('pushes the fallback when the caller keeps the current screen in the stack (#1727)', () => {
    const router = makeRouter(false)
    goBackOrReplace(router as any, '/', { fallbackMode: 'push' })
    expect(router.push).toHaveBeenCalledWith('/')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('falls back to replace when push mode is requested but the router has no push', () => {
    const router = { back: jest.fn(), canGoBack: () => false, replace: jest.fn() }
    goBackOrReplace(router as any, '/', { fallbackMode: 'push' })
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('treats a router without canGoBack as having no history', () => {
    const router = { back: jest.fn(), replace: jest.fn() }
    goBackOrReplace(router as any, '/articles')
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/articles')
  })
})
