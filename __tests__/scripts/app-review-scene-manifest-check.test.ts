const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir, runNodeCli, writeJsonFile } = require('./cli-test-utils')

// #2136: отказ Apple 25.09.2026 прошёл мимо предсабмитной сверки — 1.2 считали
// закрытым «по кнопкам», а каталог сцен не знал подпунктов гайдлайнов. Теперь
// каждый подпункт объявлен в scenes.json и без доказательства на exact build
// валит проверку манифеста.
const skillDir = path.resolve(process.cwd(), '.codex/skills/metravel-app-review-evidence')
const checkerPath = path.join(skillDir, 'scripts/scene-manifest-check.mjs')
const catalog = JSON.parse(fs.readFileSync(path.join(skillDir, 'scenes.json'), 'utf8'))

type Scene = { id: string; required: boolean }
type Guideline = { id: string; scenes: string[]; attestation?: string }

const sceneIds = new Set((catalog.scenes as Scene[]).map((scene) => scene.id))
const guidelines = catalog.guidelines as Guideline[]

const notProvenIds = (stdout: string) =>
  Array.from(stdout.matchAll(/^- guideline (\S+) not proven/gm), (match) => match[1])

describe('App Review scene manifest check (#2136)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = makeTempDir('app-review-manifest-')
  })

  afterEach(() => {
    removeDir(tempDir)
  })

  const runCheck = (manifest: unknown) => {
    const manifestPath = path.join(tempDir, 'manifest.json')
    writeJsonFile(manifestPath, manifest)
    return runNodeCli([checkerPath, manifestPath])
  }

  const fullEvidence = (build: string) => ({
    version: '1.0.5',
    build,
    scenarios: Array.from(sceneIds, (id, index) => ({
      id,
      result: 'pass',
      videoTimecode: `00:${String(index).padStart(2, '0')}`,
    })),
    attestations: guidelines
      .filter((guideline) => guideline.attestation)
      .map((guideline) => ({ id: guideline.id, build, evidence: 'dated probe' })),
  })

  it('catalog declares every guideline sub-point of 1.2, 4.8, 5.1.1(v) and 5.1.2(i)', () => {
    expect(guidelines.map((guideline) => guideline.id)).toEqual([
      '1.2(a)', '1.2(b)', '1.2(c)', '1.2(d)', '1.2(e)', '4.8', '5.1.1(v)', '5.1.2(i)',
    ])
  })

  it('catalog has the scenes from the 25.09 rejection as required', () => {
    for (const id of ['eula-before-auth', 'ugc-flag-content', 'ugc-block-hides-content', 'no-cookie-ui']) {
      expect(catalog.scenes).toContainEqual(expect.objectContaining({ id, required: true }))
    }
  })

  it('every guideline is backed by required scenes or an attestation', () => {
    const required = new Set((catalog.scenes as Scene[]).filter((scene) => scene.required).map((scene) => scene.id))
    for (const guideline of guidelines) {
      expect(guideline.scenes.length > 0 || Boolean(guideline.attestation)).toBe(true)
      for (const id of guideline.scenes) expect(required.has(id)).toBe(true)
    }
  })

  it('an empty evidence set fails every guideline sub-point', () => {
    const result = runCheck({})

    expect(result.status).toBe(1)
    expect(notProvenIds(result.stdout)).toEqual(guidelines.map((guideline) => guideline.id))
  })

  it('passing scenes and same-build attestations prove every sub-point', () => {
    const result = runCheck(fullEvidence('11'))

    // Видео в пробе нет, поэтому общий вердикт FAIL; подпункты — доказаны.
    expect(result.status).toBe(1)
    expect(notProvenIds(result.stdout)).toEqual([])
    expect(result.stdout).toMatch(/^1\.2\(d\)\s+proven$/m)
  })

  it('an attestation from another build does not count', () => {
    const manifest = fullEvidence('11')
    manifest.attestations = manifest.attestations.map((item) =>
      item.id === '1.2(d)' ? { ...item, build: '10' } : item,
    )

    const result = runCheck(manifest)

    expect(result.stdout).toContain('attestation 1.2(d): build "10" is not the candidate build "11"')
    expect(notProvenIds(result.stdout)).toEqual(['1.2(d)'])
  })

  it('a notApplicable scene never proves a sub-point', () => {
    const manifest = {
      ...fullEvidence('11'),
      scenarios: fullEvidence('11').scenarios.filter((scene) => scene.id !== 'no-cookie-ui'),
      notApplicable: [{ id: 'no-cookie-ui', reason: 'iPhone only', evidence: 'none' }],
    }

    const result = runCheck(manifest)

    expect(notProvenIds(result.stdout)).toEqual(['5.1.2(i)'])
  })
})
