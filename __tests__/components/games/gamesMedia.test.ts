import { parseColoringSheets, parseGamesMediaManifest } from '@/components/games/gamesMedia'

const revision = 'belarus-poland-01-059f92c4b3de'
const root = `/travel-games-media/${revision}`
const manifest = {
  schemaVersion: 1,
  revision,
  coloringIndexUrl: `${root}/coloring-index.json`,
  collections: [{ id: 'belarus-poland-01', title: 'Беларусь и Польша', pdfUrl: `${root}/book.pdf`, sheetCount: 9 }],
  decks: [],
  quizzes: [],
}
const sheet = {
  id: 'nesvizh', travelId: 201, placeTitle: 'Несвижский замок',
  previewUrl: `${root}/nesvizh.webp`, pdfUrl: `${root}/nesvizh-a4.pdf`,
}

describe('games media publication contract', () => {
  it('reads the published revision and associates a sheet with its stable travel ID', () => {
    expect(parseGamesMediaManifest(manifest)).toEqual({
      revision, coloringIndexUrl: manifest.coloringIndexUrl, collections: manifest.collections,
    })
    expect(parseColoringSheets({ schemaVersion: 1, sheets: [sheet] }, revision)).toEqual([sheet])
  })

  it.each([
    'https://metravel.by/travel-games-media/belarus-poland-01-059f92c4b3de/book.pdf',
    '//other.example/book.pdf',
    `${root}/../book.pdf`,
    `${root}/%2e%2e/book.pdf`,
    `${root}/book.pdf?redirect=other`,
    '/travel-games-media/old-revision/book.pdf',
  ])('rejects a download outside the versioned media family: %s', pdfUrl => {
    expect(() => parseGamesMediaManifest({
      ...manifest, collections: [{ ...manifest.collections[0], pdfUrl }],
    })).toThrow('Invalid coloring collection')
  })

  it('rejects duplicate sheet identifiers, malformed IDs and unsupported schema revisions', () => {
    expect(() => parseColoringSheets({ schemaVersion: 1, sheets: [sheet, sheet] }, revision)).toThrow()
    expect(() => parseColoringSheets({ schemaVersion: 1, sheets: [{ ...sheet, travelId: '201' }] }, revision)).toThrow()
    expect(() => parseGamesMediaManifest({ ...manifest, schemaVersion: 2 })).toThrow()
  })
})
