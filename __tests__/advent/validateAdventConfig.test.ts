import path from 'node:path'
import campaign from '@/data/advent/2026.json'

// CommonJS-валидатор общий с гейтом `scripts/validate-advent-config.mjs`.
const { validateAdventConfig, defaultRouteExists } = require('../../scripts/lib/advent-config-validator.js') as {
  validateAdventConfig: (config: unknown, options?: { routeExists?: (route: string) => boolean }) => string[]
  defaultRouteExists: (root: string) => (route: string) => boolean
}

const clone = () => JSON.parse(JSON.stringify(campaign)) as typeof campaign
const routeExists = defaultRouteExists(path.resolve(__dirname, '..', '..'))

describe('advent config validator (#2862)', () => {
  it('accepts the shipped 2026 config, including every CTA and gift route', () => {
    expect(validateAdventConfig(campaign, { routeExists })).toEqual([])
  })

  it('reports a broken date in plain words', () => {
    const broken = clone()
    broken.doors[4].date = '2026-12-06'
    const errors = validateAdventConfig(broken)
    expect(errors.some((message) => message.includes('day 5') && message.includes('2026-12-05'))).toBe(true)
  })

  it('rejects duplicate dates and wrong door count', () => {
    const broken = clone()
    broken.doors[1].date = broken.doors[0].date
    expect(validateAdventConfig(broken).some((message) => message.includes('повторяется'))).toBe(true)
    const short = clone()
    short.doors.pop()
    expect(validateAdventConfig(short).some((message) => message.includes('27'))).toBe(true)
  })

  it('requires an answer pattern for riddles and a radius for geo doors', () => {
    const broken = clone()
    delete (broken.doors[2].task.riddle!.questions[0] as { answer_pattern?: unknown }).answer_pattern
    ;(broken.doors[8].task.geo as { radiusMeters: number }).radiusMeters = 0
    const errors = validateAdventConfig(broken)
    expect(errors.some((message) => message.includes('answer_pattern'))).toBe(true)
    expect(errors.some((message) => message.includes('radiusMeters'))).toBe(true)
  })

  it('rejects CTA routes that do not exist in the app', () => {
    const broken = clone()
    broken.doors[1].task.ctaRoute = '/no-such-route'
    expect(validateAdventConfig(broken, { routeExists }).some((message) => message.includes('/no-such-route'))).toBe(true)
  })
})

describe('advent config validator — solvability and secret doors', () => {
  it('rejects a quiz whose options do not contain the answer', () => {
    const broken = clone()
    broken.doors[5].task.riddle!.questions[0].options = ['1', '2', '3']
    expect(validateAdventConfig(broken).some((message) => message.includes('options'))).toBe(true)
  })

  it('allows secret only on bonus doors', () => {
    const broken = clone()
    ;(broken.doors[0] as { secret?: boolean }).secret = true
    expect(validateAdventConfig(broken).some((message) => message.includes('secret'))).toBe(true)
  })
})
