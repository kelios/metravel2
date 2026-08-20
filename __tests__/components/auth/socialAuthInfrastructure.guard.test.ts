import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WEB_PROVIDER_FILES = [
  'components/auth/AppleSignInButton.web.tsx',
  'components/auth/GoogleSignInButton.web.tsx',
  'components/auth/FacebookSignInButton.web.tsx',
] as const

const GEOMETRY_CONSUMER_FILES = [
  'components/auth/SocialAuthButton.web.tsx',
  'components/auth/FacebookSignInButton.native.tsx',
] as const

const GEOMETRY_KEYS = [
  'minHeight',
  'borderRadius',
  'disabledOpacity',
  'pressedOpacity',
  'pressedScale',
  'contentGap',
  'paddingHorizontal',
  'fontSize',
] as const

const ALL_GUARDED_FILES = [
  ...WEB_PROVIDER_FILES,
  ...GEOMETRY_CONSUMER_FILES,
  'components/auth/socialAuthButtonGeometry.ts',
] as const

type GuardedFile = (typeof ALL_GUARDED_FILES)[number]
type GuardedSources = Record<GuardedFile, string>

const readGuardedSources = (): GuardedSources =>
  Object.fromEntries(
    ALL_GUARDED_FILES.map((file) => [
      file,
      readFileSync(resolve(process.cwd(), file), 'utf8'),
    ]),
  ) as GuardedSources

const findSocialAuthInfrastructureDrift = (sources: GuardedSources) => {
  const violations: string[] = []

  WEB_PROVIDER_FILES.forEach((file) => {
    const source = sources[file]
    const importCount = (
      source.match(
        /import\s*\{[^}]*\buseExternalScript\b[^}]*\}\s*from\s*['"]@\/hooks\/useExternalScript['"]/g,
      ) || []
    ).length
    if (importCount !== 1) {
      violations.push(`${file}: expected exactly one useExternalScript import`)
    }
    if ((source.match(/\buseExternalScript\s*\(/g) || []).length !== 1) {
      violations.push(`${file}: expected exactly one useExternalScript call`)
    }
    if (/\bdocument\s*\./.test(source)) {
      violations.push(`${file}: direct DOM script infrastructure is forbidden`)
    }
  })

  GEOMETRY_CONSUMER_FILES.forEach((file) => {
    const source = sources[file]
    if (!source.includes("from '@/components/auth/socialAuthButtonGeometry'")) {
      violations.push(`${file}: missing shared geometry import`)
    }
    GEOMETRY_KEYS.forEach((key) => {
      if (!source.includes(`SOCIAL_AUTH_BUTTON_GEOMETRY.${key}`)) {
        violations.push(`${file}: bypasses shared geometry key ${key}`)
      }
    })
    if (
      /minHeight\s*:\s*48\b|borderRadius\s*:\s*DESIGN_TOKENS\.radii\.lg\b|opacity\s*:\s*0\.(?:55|88)\b|scale\s*:\s*0\.99\b|gap\s*:\s*12\b|paddingHorizontal\s*:\s*16\b|fontSize\s*:\s*16\b/.test(
        source,
      )
    ) {
      violations.push(`${file}: duplicates shared geometry literals`)
    }
  })

  const geometrySource = sources['components/auth/socialAuthButtonGeometry.ts']
  ;[
    'minHeight: 48',
    'borderRadius: DESIGN_TOKENS.radii.lg',
    'disabledOpacity: 0.55',
    'pressedOpacity: 0.88',
    'pressedScale: 0.99',
    'contentGap: 12',
    'paddingHorizontal: 16',
    'fontSize: 16',
  ].forEach((contract) => {
    if (!geometrySource.includes(contract)) {
      violations.push(`socialAuthButtonGeometry.ts: missing ${contract}`)
    }
  })

  return violations
}

describe('social auth infrastructure consolidation guard', () => {
  it('keeps provider script loading and custom-button geometry on shared contracts', () => {
    expect(findSocialAuthInfrastructureDrift(readGuardedSources())).toEqual([])
  })

  it('detects direct loader and geometry copies', () => {
    const sources = readGuardedSources()
    const bypassed: GuardedSources = {
      ...sources,
      'components/auth/AppleSignInButton.web.tsx': sources[
        'components/auth/AppleSignInButton.web.tsx'
      ].replace(
        'useExternalScript({',
        "document.createElement('script')\n    useExternalScript({",
      ),
      'components/auth/FacebookSignInButton.native.tsx': sources[
        'components/auth/FacebookSignInButton.native.tsx'
      ].replace(
        'minHeight: SOCIAL_AUTH_BUTTON_GEOMETRY.minHeight',
        'minHeight: 48',
      ),
    }

    expect(findSocialAuthInfrastructureDrift(bypassed)).toEqual(
      expect.arrayContaining([
        'components/auth/AppleSignInButton.web.tsx: direct DOM script infrastructure is forbidden',
        'components/auth/FacebookSignInButton.native.tsx: bypasses shared geometry key minHeight',
        'components/auth/FacebookSignInButton.native.tsx: duplicates shared geometry literals',
      ]),
    )
  })
})
