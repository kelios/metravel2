import fs from 'node:fs'
import path from 'node:path'

const APP_DIR = path.resolve(__dirname, '../../app/(tabs)')

const STATIC_ROUTES = [
  '/',
  '/accountconfirmation',
  '/export',
  '/login',
  '/map',
  '/metravel',
  '/profile',
  '/quests',
  '/registration',
  '/search',
  '/set-password',
  '/travel/new',
  '/travelsby',
]

const DYNAMIC_ROUTES = [
  '/quests/[city]/[questId]',
  '/travel/[id]',
  '/travels/[param]',
]

const routeExists = (routePath: string): boolean => {
  const cleanPath = routePath.replace(/^\//, '')
  if (!cleanPath) return fs.existsSync(path.join(APP_DIR, 'index.tsx'))

  const candidate = path.join(APP_DIR, cleanPath)
  if (fs.existsSync(`${candidate}.tsx`) || fs.existsSync(`${candidate}.ts`)) return true
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) return false
  return fs.existsSync(path.join(candidate, 'index.tsx')) || fs.existsSync(path.join(candidate, 'index.ts'))
}

describe('app route files', () => {
  it.each(STATIC_ROUTES)('contains the static route %s', (routePath) => {
    expect(routeExists(routePath)).toBe(true)
  })

  it.each(DYNAMIC_ROUTES)('contains the dynamic route %s', (routePath) => {
    expect(routeExists(routePath)).toBe(true)
  })

  it('keeps the route contract free of duplicate entries', () => {
    const allRoutes = [...STATIC_ROUTES, ...DYNAMIC_ROUTES]
    expect(new Set(allRoutes).size).toBe(allRoutes.length)
  })
})
