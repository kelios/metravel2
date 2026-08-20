import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = process.cwd()
const CANONICAL_OWNER = 'hooks/useTravelFormPersistence.ts'
const TRAVEL_FORM = 'hooks/useTravelFormData.ts'
const GENERIC_FORM_STATE = 'hooks/useOptimizedFormState.ts'
const EDITOR_TYPES = 'components/article/articleEditor.types.ts'
const EDITOR_WEB = 'components/article/ArticleEditor.web.tsx'
const EDITOR_IOS = 'components/article/ArticleEditor.ios.tsx'

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(resolve(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(ROOT, directory, entry.name)
    if (entry.isDirectory()) {
      return collectSourceFiles(relative(ROOT, absolutePath))
    }
    return ['.ts', '.tsx'].includes(extname(entry.name))
      ? [relative(ROOT, absolutePath)]
      : []
  })

const TRAVEL_COMPONENT_FILES = collectSourceFiles('components/travel')

const GUARDED_FILES = [
  CANONICAL_OWNER,
  TRAVEL_FORM,
  GENERIC_FORM_STATE,
  EDITOR_TYPES,
  EDITOR_WEB,
  EDITOR_IOS,
  ...TRAVEL_COMPONENT_FILES,
] as const

type GuardedFile = (typeof GUARDED_FILES)[number]
type GuardedSources = Record<GuardedFile, string>

const readGuardedSources = (): GuardedSources =>
  Object.fromEntries(
    GUARDED_FILES.map((file) => [file, readFileSync(join(ROOT, file), 'utf8')]),
  ) as GuardedSources

const findTravelAutosaveOwnershipDrift = (sources: GuardedSources): string[] => {
  const violations: string[] = []
  const genericFormSource = sources[GENERIC_FORM_STATE]
  const editorTypesSource = sources[EDITOR_TYPES]
  const editorWebSource = sources[EDITOR_WEB]
  const editorIosSource = sources[EDITOR_IOS]

  const autosaveEngineOwners = [CANONICAL_OWNER, TRAVEL_FORM, ...TRAVEL_COMPONENT_FILES]
    .flatMap((file) =>
      Array.from(sources[file].matchAll(/\buseImprovedAutoSave\s*\(/g), () => file),
    )
  if (
    autosaveEngineOwners.length !== 1 ||
    autosaveEngineOwners[0] !== CANONICAL_OWNER
  ) {
    violations.push(`${CANONICAL_OWNER}: expected exactly one canonical autosave engine`)
  }

  const persistenceOwners = [TRAVEL_FORM, ...TRAVEL_COMPONENT_FILES]
    .flatMap((file) =>
      Array.from(sources[file].matchAll(/\buseTravelFormPersistence\s*\(/g), () => file),
    )
  if (persistenceOwners.length !== 1 || persistenceOwners[0] !== TRAVEL_FORM) {
    violations.push(`${TRAVEL_FORM}: expected exactly one canonical persistence owner`)
  }
  if (/\bonSave\s*[?:]/.test(genericFormSource)) {
    violations.push(`${GENERIC_FORM_STATE}: server-write callback is forbidden`)
  }
  if (!editorTypesSource.includes("autosaveMode: 'standalone'")) {
    violations.push(`${EDITOR_TYPES}: standalone editor autosave must be explicit`)
  }
  if (!editorWebSource.includes("autosaveMode === 'standalone'")) {
    violations.push(`${EDITOR_WEB}: standalone editor autosave lacks a runtime gate`)
  }
  if (!editorIosSource.includes("autosaveMode === 'standalone'")) {
    violations.push(`${EDITOR_IOS}: standalone editor autosave lacks a runtime gate`)
  }

  TRAVEL_COMPONENT_FILES.forEach((file) => {
    if (/\b(?:onAutosave|autosaveMode)\s*=/.test(sources[file])) {
      violations.push(`${file}: travel must not activate ArticleEditor autosave`)
    }
  })

  return violations
}

describe('travel autosave owner guard', () => {
  it('keeps one canonical travel write owner and explicit standalone editor autosave', () => {
    expect(findTravelAutosaveOwnershipDrift(readGuardedSources())).toEqual([])
  })

  it('detects artificial second form and editor write paths', () => {
    const sources = readGuardedSources()
    const mutated: GuardedSources = {
      ...sources,
      [GENERIC_FORM_STATE]: `${sources[GENERIC_FORM_STATE]}\ntype DuplicateEngine<T> = { onSave?: (data: T) => Promise<T> }\n`,
      [EDITOR_IOS]: sources[EDITOR_IOS].replace(
        "autosaveMode === 'standalone'",
        "autosaveMode === 'implicit'",
      ),
      'components/travel/ContentUpsertSection.tsx': sources[
        'components/travel/ContentUpsertSection.tsx'
      ].replace('<ArticleEditor', [
        'useImprovedAutoSave(formData, initialData, autosaveOptions);',
        '<ArticleEditor autosaveMode="standalone" onAutosave={saveTravel}',
      ].join('\n')),
    }

    expect(findTravelAutosaveOwnershipDrift(mutated)).toEqual(
      expect.arrayContaining([
        `${GENERIC_FORM_STATE}: server-write callback is forbidden`,
        `${CANONICAL_OWNER}: expected exactly one canonical autosave engine`,
        `${EDITOR_IOS}: standalone editor autosave lacks a runtime gate`,
        'components/travel/ContentUpsertSection.tsx: travel must not activate ArticleEditor autosave',
      ]),
    )
  })
})
