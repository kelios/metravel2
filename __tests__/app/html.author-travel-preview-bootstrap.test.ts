import fs from 'fs'
import path from 'path'

const htmlSource = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')

function runHeroBootstrap(pathname: string, search = '') {
  const marker = 'const getTravelHeroPreloadScript = () => String.raw`'
  const start = htmlSource.indexOf(marker) + marker.length
  const body = htmlSource.slice(start, htmlSource.indexOf('`', start))
  const script = new Function('process', 'TRAVEL_HERO_PRELOAD_SCRIPT_SRC', `return String.raw\`${body}\``)(
    { env: { NODE_ENV: 'production' } }, '/travel-hero-preload-v2.js',
  )
  const appendChild = jest.fn()
  const win = { location: { pathname, search } } as Record<string, unknown>
  const doc = { head: { appendChild }, createElement: () => ({ setAttribute: jest.fn() }) }
  new Function('window', 'document', script)(win, doc)
  return { win, appendChild }
}

describe('author preview keeps the original document route until React commits (#2695)', () => {
  it('has no author-preview history rewrite before hydration', () => {
    expect(htmlSource).not.toContain('getAuthorTravelPreviewBootstrapScript')
  })

  it.each(['?previewTravel=7100', '?previewTravel=0', '?previewTravel=slug', ''])(
    'does not start public preload for the editor document %s', (search) => {
      const { win, appendChild } = runHeroBootstrap('/travel/new', search)
      expect(win.location).toEqual({ pathname: '/travel/new', search })
      expect(appendChild).not.toHaveBeenCalled()
      expect(win.__metravelTravelPreloadTargetPath).toBeUndefined()
      expect(win.__metravelTravelPreloadScriptLoaded).toBeUndefined()
    },
  )

  it.each(['/travels/42', '/travels/public-slug'])(
    'still starts public preload for an initial detail document %s', (pathname) => {
      const { win, appendChild } = runHeroBootstrap(pathname)
      expect(appendChild).toHaveBeenCalledTimes(1)
      expect(win.__metravelTravelPreloadTargetPath).toBe(pathname)
    },
  )
})
