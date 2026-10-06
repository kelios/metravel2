const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./cli-test-utils')
const { listSlides, parseArgs, parseRange, readCaption } = require('../../scripts/instagram-post')

describe('instagram-post', () => {
  const dir = makeTempDir('ig-post-')
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('publishes only with the explicit approval flag', () => {
    const base = ['--carousel', dir, '--caption-file', 'c.txt']
    expect(parseArgs(base)).toMatchObject({ kind: 'carousel', publishApproved: false })
    expect(parseArgs([...base, '--publish-approved']).publishApproved).toBe(true)
  })

  it('rejects ambiguous or incomplete requests', () => {
    expect(() => parseArgs(['--caption-file', 'c.txt'])).toThrow('exactly one')
    expect(() => parseArgs(['--carousel', dir, '--reel', 'a.mp4', '--caption-file', 'c.txt'])).toThrow('exactly one')
    expect(() => parseArgs(['--reel', 'a.mp4'])).toThrow('--caption-file')
    expect(() => parseArgs(['--image', 'a.jpg', '--caption-file', 'c.txt', '--trial', 'manual'])).toThrow('--reel only')
    expect(() => parseArgs(['--reel', 'a.mp4', '--caption-file', 'c.txt', '--trial', 'soon'])).toThrow('manual or auto')
  })

  it('orders slides by name and enforces carousel size', () => {
    fs.writeFileSync(path.join(dir, '02.jpg'), '')
    expect(() => listSlides(dir)).toThrow('at least 2')
    fs.writeFileSync(path.join(dir, '01.jpg'), '')
    fs.writeFileSync(path.join(dir, 'notes.txt'), '')
    expect(listSlides(dir).map((f: string) => path.basename(f))).toEqual(['01.jpg', '02.jpg'])
  })

  it('refuses empty and oversized captions', () => {
    const file = path.join(dir, 'caption.txt')
    fs.writeFileSync(file, '  \n')
    expect(() => readCaption(file)).toThrow('empty')
    fs.writeFileSync(file, 'я'.repeat(2201))
    expect(() => readCaption(file)).toThrow('2200')
    fs.writeFileSync(file, ' Татры \n')
    expect(readCaption(file)).toBe('Татры')
  })

  it('serves the byte ranges the video fetcher asks for', () => {
    expect(parseRange(undefined, 100)).toBeNull()
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 })
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 })
    expect(parseRange('bytes=200-300', 100)).toBeNull()
  })
})
