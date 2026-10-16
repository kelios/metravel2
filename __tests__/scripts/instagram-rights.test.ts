const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const childProcess = require('child_process')
const { makeTempDir } = require('./cli-test-utils')
const { validateRights } = require('../../scripts/lib/instagramRights')

// The gate verifies document binding/scope; it cannot determine whether evidence is truthful.
describe('Instagram rights evidence gate', () => {
  const dir = makeTempDir('ig-rights-')
  const manifestFile = path.join(dir, 'rights.json')
  const image = path.join(dir, 'final.jpg')
  const day = new Date().toISOString().slice(0, 10)
  const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex')
  const scope = { account: '@metravelby', platforms: ['instagram'], uses: ['organic'], territories: ['worldwide'], validFrom: day, validUntil: 'perpetual' }
  let manifest: any
  const save = () => fs.writeFileSync(manifestFile, JSON.stringify(manifest))
  const validate = () => { save(); return validateRights(manifestFile, [image]) }

  beforeEach(() => {
    fs.writeFileSync(image, 'final image bytes')
    fs.writeFileSync(path.join(dir, 'evidence.txt'), 'Own source, commercial promotional use, worldwide, account/tier: owner.')
    manifest = { version: 1, account: '@metravelby', reviewedAt: day, intendedPublishAt: day,
      assets: [{ file: 'final.jpg', sha256: sha256('final.jpg'), kind: 'image', basis: 'owned', source: 'Julia original camera photo',
        evidence: [{ file: 'evidence.txt', sha256: sha256('evidence.txt') }], scope: { ...scope } }] }
  })
  afterEach(() => jest.restoreAllMocks())
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('accepts documented, hash-bound own media and rejects any edited export', () => {
    expect(validate().account).toBe('@metravelby')
    fs.writeFileSync(image, 'new final image bytes')
    expect(validate).toThrow('SHA-256 mismatch')
  })

  it('requires the manifest even for rehearsals and every selected upload', () => {
    expect(() => validateRights(undefined, [image])).toThrow('--rights-file')
    const unlisted = path.join(dir, 'other.jpg')
    fs.writeFileSync(unlisted, 'other image')
    save()
    expect(() => validateRights(manifestFile, [unlisted])).toThrow('missing from rights.json')
    expect(() => validateRights(manifestFile, [{ file: image, kind: 'video' }])).toThrow('wrong kind')
  })

  it('requires real evidence files and their current hash, not approved flags', () => {
    manifest.approved = true
    manifest.assets[0].evidence = []
    expect(validate).toThrow('local evidence')
    manifest.assets[0].evidence = [{ file: 'missing.pdf', sha256: 'a'.repeat(64) }]
    expect(validate).toThrow('ENOENT')
    manifest.assets[0].evidence = [{ file: 'evidence.txt', sha256: 'a'.repeat(64) }]
    expect(validate).toThrow('SHA-256 mismatch')
  })

  it.each([
    ['account', '@another'], ['platforms', ['tiktok']], ['uses', ['private']], ['territories', ['PL']],
    ['validUntil', '2000-01-01'], ['validFrom', '2999-01-01'],
  ])('rejects incompatible license scope %s', (key: string, value: any) => {
    manifest.assets[0].scope[key] = value
    expect(validate).toThrow(/scope|license/)
  })

  it('rejects past intended publication dates and future reviews', () => {
    manifest.intendedPublishAt = '2000-01-01'
    expect(validate).toThrow('date')
    manifest.intendedPublishAt = day
    manifest.reviewedAt = '2999-01-01'
    expect(validate).toThrow('date')
  })

  it('requires current upload coverage and the actual date for immediate publication', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    manifest.intendedPublishAt = tomorrow
    manifest.assets[0].scope.validFrom = tomorrow
    expect(validate).toThrow('current upload date')
    manifest.assets[0].scope.validFrom = day
    expect(validate().intendedPublishAt).toBe(tomorrow)
    expect(() => validateRights(manifestFile, [image], { publishNow: true })).toThrow('match today')
    manifest.intendedPublishAt = day
    save()
    expect(validateRights(manifestFile, [image], { publishNow: true }).account).toBe('@metravelby')
  })

  it('does not let evidence symlinks escape the package', () => {
    fs.symlinkSync(path.join(__dirname, 'instagram-post.test.ts'), path.join(dir, 'outside.txt'))
    manifest.assets[0].evidence[0].file = 'outside.txt'
    expect(validate).toThrow('escapes package')
  })

  it('accepts silent video only when ffprobe confirms no audio stream', () => {
    const file = path.join(dir, 'reel.mp4')
    fs.writeFileSync(file, 'video bytes')
    manifest.assets[0] = { ...manifest.assets[0], file: 'reel.mp4', kind: 'video', sha256: sha256('reel.mp4'), audio: { mode: 'silent' } }
    save()
    const probe = jest.spyOn(childProcess, 'spawnSync').mockReturnValue({ status: 0, stdout: JSON.stringify({ streams: [{ codec_type: 'video' }] }) })
    expect(validateRights(manifestFile, [file]).assets[0].audio.mode).toBe('silent')
    probe.mockReturnValue({ status: 0, stdout: JSON.stringify({ streams: [{ codec_type: 'video' }, { codec_type: 'audio' }] }) })
    expect(() => validateRights(manifestFile, [file])).toThrow('does not match')
    manifest.assets[0].audio.mode = 'original'
    save()
    expect(() => validateRights(manifestFile, [file])).toThrow('local evidence')
    manifest.assets[0].audio.evidence = manifest.assets[0].evidence
    save()
    expect(validateRights(manifestFile, [file]).assets[0].audio.mode).toBe('original')
    manifest.assets[0].audio = { ...manifest.assets[0].audio, mode: 'licensed', basis: 'licensed', source: 'Music provider', scope: { ...scope, platforms: ['youtube'] } }
    save()
    expect(() => validateRights(manifestFile, [file])).toThrow('scope')
  })

  it('fails closed if ffprobe cannot verify a video', () => {
    const file = path.join(dir, 'unreadable.mp4')
    fs.writeFileSync(file, 'video bytes')
    manifest.assets[0] = { ...manifest.assets[0], file: 'unreadable.mp4', kind: 'video', sha256: sha256('unreadable.mp4'), audio: { mode: 'silent' } }
    save()
    jest.spyOn(childProcess, 'spawnSync').mockReturnValue({ status: 1 })
    expect(() => validateRights(manifestFile, [file])).toThrow('ffprobe')
  })
})
