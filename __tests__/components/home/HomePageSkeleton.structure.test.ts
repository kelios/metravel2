import fs from 'fs'
import path from 'path'

const repoRoot = path.resolve(__dirname, '..', '..', '..')

describe('HomePageSkeleton structure', () => {
  it('does not advertise the removed how-it-works section', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'components/home/HomePageSkeleton.tsx'),
      'utf8',
    )

    expect(source).not.toContain('HowItWorksSkeleton')
    expect(source).not.toContain('how-card-')
    expect(fs.existsSync(path.join(repoRoot, 'components/home/HomeHowItWorks.tsx'))).toBe(false)
  })

  it.each(['ru', 'be', 'uk', 'pl', 'en'])('removes dead HomeHowItWorks keys from %s', (locale) => {
    const staticResources = fs.readFileSync(
      path.join(repoRoot, `i18n/locales/${locale}/static/home_static.ts`),
      'utf8',
    )
    const generatedResources = fs.readFileSync(
      path.join(repoRoot, `i18n/locales/${locale}/generated/home_01.ts`),
      'utf8',
    )

    expect(staticResources).not.toContain('components.home.HomeHowItWorks.')
    expect(generatedResources).not.toContain('components.home.HomeHowItWorks.')
    expect(staticResources).not.toContain('"howItWorks.')
  })
})
