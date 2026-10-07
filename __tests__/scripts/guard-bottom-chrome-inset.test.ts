import fs from 'node:fs'
import path from 'node:path'

import { makeTempDir, removeDir } from './cli-test-utils'

const {
  collectViolations,
  findViolationsInSource,
  lineComputesDockHeight,
} = require('../../scripts/guard-bottom-chrome-inset')

// #2097 / #2153, MOBILE-INSETS-001: высота дока считается в одном месте
// (`components/layout/bottomChromeInset`). Страж судит обе стороны: реальное дерево
// проходит, а возвращённая константа — падает с файлом и строкой.
describe('guard-bottom-chrome-inset', () => {
  it('ловит литерал высоты дока в тернарнике нижнего отступа листа (#2153)', () => {
    expect(lineComputesDockHeight('marginBottom: bottomOffset ?? (IS_WEB ? 58 : 0),')).toBe(true)
    expect(lineComputesDockHeight("bottom: Platform.OS === 'web' ? 56 : 0,")).toBe(true)
  })

  it('ловит прежние формы локального расчёта дока (#2097)', () => {
    expect(lineComputesDockHeight('const pad = LAYOUT.tabBarHeight + 8')).toBe(true)
    expect(lineComputesDockHeight('paddingBottom: BOTTOM_DOCK_HEIGHT + insets.bottom,')).toBe(true)
    expect(lineComputesDockHeight('const reserve = insets.bottom + 56')).toBe(true)
    expect(lineComputesDockHeight('const DOCK_RESERVE = 56')).toBe(true)
  })

  it('не трогает отступ из общего резерва и посторонние числа', () => {
    expect(lineComputesDockHeight('marginBottom: asBottomDimension(chromeBottom),')).toBe(false)
    expect(lineComputesDockHeight('paddingBottom: Math.max(insets.bottom || 0, 16),')).toBe(false)
    expect(lineComputesDockHeight('marginBottom: compact ? 8 : 16,')).toBe(false)
    expect(lineComputesDockHeight('width: wide ? 58 : 44,')).toBe(false)
    expect(lineComputesDockHeight('minHeight: 56,')).toBe(false)
  })

  it('комментарий с константой — не нарушение, код в той же строке — нарушение', () => {
    expect(findViolationsInSource('components/ui/Sheet.tsx', '// раньше было marginBottom: IS_WEB ? 58 : 0\n')).toEqual([])
    expect(
      findViolationsInSource('components/ui/Sheet.tsx', 'const a = 1\n  marginBottom: IS_WEB ? 58 : 0, // док\n'),
    ).toEqual(['components/ui/Sheet.tsx:2: marginBottom: IS_WEB ? 58 : 0, // док'])
  })

  it('rejects an independent dock literal in web toast/consent/install anchors (#2299)', () => {
    expect(findViolationsInSource('components/ui/ToastHost.web.tsx', '...(isBottom ? { bottom: 72 } : { top: 12 }),')).toHaveLength(1)
    expect(findViolationsInSource('components/layout/ConsentBanner.tsx', 'bottom: 56,')).toHaveLength(1)
    expect(findViolationsInSource('components/layout/AppInstallBar.tsx', 'bottom: webDockReserve(8),')).toEqual([])
  })

  it('негативная проба на дереве: лист с константой дока роняет стража, владельцы дока — нет', () => {
    const root = makeTempDir('guard-bottom-chrome-inset-')
    try {
      fs.mkdirSync(path.join(root, 'components/ui'), { recursive: true })
      fs.mkdirSync(path.join(root, 'components/layout'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'components/ui/LegacySheet.tsx'),
        'export const panel = {\n  marginBottom: bottomOffset ?? (IS_WEB ? 58 : 0),\n}\n',
      )
      fs.writeFileSync(
        path.join(root, 'components/layout/bottomDockModel.ts'),
        'export const BOTTOM_DOCK_HEIGHT = 56\n',
      )

      expect(collectViolations(root)).toEqual([
        'components/ui/LegacySheet.tsx:2: marginBottom: bottomOffset ?? (IS_WEB ? 58 : 0),',
      ])
    } finally {
      removeDir(root)
    }
  })

  it('allows the actual moved definition/producer only; the same symbol in another consumer still fails (#2216)', () => {
    const root = makeTempDir('guard-bottom-chrome-canonical-producers-')
    try {
      fs.mkdirSync(path.join(root, 'components/layout'), { recursive: true })
      fs.mkdirSync(path.join(root, 'components/ui'), { recursive: true })
      for (const file of ['bottomDockItemDefs.ts', 'WebMobileDockShell.tsx']) {
        fs.copyFileSync(path.join(__dirname, '../../components/layout', file), path.join(root, 'components/layout', file))
      }
      expect(collectViolations(root)).toEqual([])
      // Same producer filename in another directory is an ordinary consumer;
      // the two exact owner allowances must not become a basename/global exemption.
      fs.writeFileSync(path.join(root, 'components/ui/WebMobileDockShell.tsx'),
        "import { BOTTOM_DOCK_HEIGHT } from '../layout/bottomDockItemDefs'\nexport const padding = BOTTOM_DOCK_HEIGHT + 8\n")
      expect(collectViolations(root)).toEqual([
        "components/ui/WebMobileDockShell.tsx:1: import { BOTTOM_DOCK_HEIGHT } from '../layout/bottomDockItemDefs'",
        'components/ui/WebMobileDockShell.tsx:2: export const padding = BOTTOM_DOCK_HEIGHT + 8',
      ])
    } finally {
      removeDir(root)
    }
  })

  it('реальное дерево проекта чистое', () => {
    expect(collectViolations()).toEqual([])
  })
})
