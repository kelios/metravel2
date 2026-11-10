const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir, writeTextFile } = require('./cli-test-utils')
const {
  DELEGATED_REMOVALS,
  EXEMPT_TYPES,
  UGC_RENDERS,
  readContentTypes,
  scanDestructiveActions,
  scanRender,
  scanUgcActions,
} = require('@/scripts/guard-ugc-actions')

// #2133: у каждого типа UGC есть жалоба (Apple 1.2(c)). Guard судит реальные
// файлы реестра; синтетические нарушения ниже доказывают, что матчер не пуст.
const repoRoot = process.cwd()
const TYPES_FILE = 'types/contentSafety.ts'

const copyIntoTemp = (root: string, rel: string) =>
  writeTextFile(path.join(root, rel), fs.readFileSync(path.join(repoRoot, rel), 'utf8'))

describe('guard-ugc-actions (#2133)', () => {
  let root: string

  beforeEach(() => {
    root = makeTempDir('ugc-actions-')
    copyIntoTemp(root, TYPES_FILE)
    Object.keys(UGC_RENDERS).forEach((rel) => copyIntoTemp(root, rel))
  })

  afterEach(() => {
    removeDir(root)
  })

  it('passes on the real repository', () => {
    expect(scanUgcActions(repoRoot)).toEqual([])
  })

  it('covers every content type by a render or a reasoned exemption', () => {
    const { types } = readContentTypes(fs.readFileSync(path.join(repoRoot, TYPES_FILE), 'utf8'))
    const covered = new Set(
      Object.values(UGC_RENDERS as Record<string, { types: string[] }>).flatMap((entry) => entry.types),
    )
    for (const type of types) {
      expect(covered.has(type) || Boolean(EXEMPT_TYPES[type])).toBe(true)
    }
  })

  it('reads hideable types from the policy record', () => {
    const { hideable } = readContentTypes(fs.readFileSync(path.join(repoRoot, TYPES_FILE), 'utf8'))
    expect([...hideable].sort()).toEqual(['message', 'place_comment', 'quest_review', 'travel', 'travel_comment', 'trip_chat_message'])
  })

  it('fails a registered render that drops the safety layer', () => {
    const findings = scanRender(
      'components/x/List.tsx',
      "const ref = makeContentRef('travel_comment', c.id, c.user)",
      { surface: 'list', types: ['travel_comment'] },
      new Set(['travel_comment']),
    )
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('без ContentSafetyActions'),
        expect.stringContaining('HiddenContentGate'),
      ]),
    )
  })

  it('does not ask a detail surface for the hidden placeholder', () => {
    const findings = scanRender(
      'components/x/Detail.tsx',
      "<ContentSafetyActions contentRef={makeContentRef('travel', t.id, a)} />",
      { surface: 'detail', types: ['travel'] },
      new Set(['travel']),
    )
    expect(findings).toEqual([])
  })

  it('fails a new content type without a render or exemption', () => {
    const typesPath = path.join(root, TYPES_FILE)
    writeTextFile(typesPath, fs.readFileSync(typesPath, 'utf8').replace("  'trip_report',\n", "  'trip_report',\n  'article',\n"))

    expect(scanUgcActions(root)).toContain('тип "article" без рендера с жалобой: добавь рендер в UGC_RENDERS или исключение с причиной')
  })

  it('fails a file that builds a content ref outside the registry', () => {
    writeTextFile(
      path.join(root, 'components/new/StoryCard.tsx'),
      "<ContentSafetyActions contentRef={makeContentRef('travel', s.id, s.user)} />",
    )

    expect(scanUgcActions(root)).toEqual([
      'components/new/StoryCard.tsx: строит ContentRef или рисует меню безопасности вне реестра UGC_RENDERS',
    ])
  })

  describe('irreversible removal asks first (#3214)', () => {
    let scope: string

    beforeEach(() => {
      scope = makeTempDir('destructive-actions-')
    })

    afterEach(() => {
      removeDir(scope)
    })

    it('passes on the real repository', () => {
      expect(scanDestructiveActions(repoRoot)).toEqual([])
    })

    it('fails a server delete without a question', () => {
      writeTextFile(
        path.join(scope, 'components/travel/Cover.tsx'),
        "import { deleteTravelMainImage } from '@/api/misc'\nconst drop = () => deleteTravelMainImage(id)\n",
      )
      expect(scanDestructiveActions(scope)).toEqual([
        'components/travel/Cover.tsx: deleteTravelMainImage(…) удаляет данные на сервере без confirmAction',
      ])
    })

    it('fails a click that removes a point directly, and passes once it asks', () => {
      const rel = 'components/map/PointRow.tsx'
      writeTextFile(path.join(scope, rel), '<button onClick={() => onRemove(index)} />')
      expect(scanDestructiveActions(scope)).toEqual([
        `${rel}: нажатие сразу вызывает onRemove(…) без confirmAction — спроси или опиши владельца в DELEGATED_REMOVALS`,
      ])

      writeTextFile(
        path.join(scope, rel),
        'const ask = async (i) => { if (await confirmAction(q)) onRemove(i) }\n<button onClick={() => void ask(index)} />',
      )
      expect(scanDestructiveActions(scope)).toEqual([])
    })

    it('fails application code that branches on JEST_WORKER_ID', () => {
      writeTextFile(path.join(scope, 'components/travel/Gallery.tsx'), 'const isJest = !!process.env.JEST_WORKER_ID\n')
      expect(scanDestructiveActions(scope)).toEqual([
        'components/travel/Gallery.tsx: ветвление по JEST_WORKER_ID в коде приложения — тесты должны идти тем же путём, что сайт',
      ])
    })

    it('checks that a delegated owner really asks', () => {
      writeTextFile(path.join(scope, 'components/travel/gallery/GalleryGrid.tsx'), '<Tile onActivate={() => onDelete(key)} />')
      writeTextFile(path.join(scope, 'components/travel/gallery/ImageGallery.tsx'), 'const handleDeleteImage = (key) => deleteByKey(key)\n')
      expect(scanDestructiveActions(scope)).toEqual([
        'components/travel/gallery/GalleryGrid.tsx: владелец components/travel/gallery/ImageGallery.tsx не спрашивает подтверждение',
      ])
      expect(DELEGATED_REMOVALS['components/travel/gallery/GalleryGrid.tsx'].reason).toBeTruthy()
    })
  })
})
