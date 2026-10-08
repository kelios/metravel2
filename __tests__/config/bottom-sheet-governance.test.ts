/**
 * @jest-environment node
 *
 * Нижний лист приложения — один: `components/ui/BottomSheet.tsx`
 * (ACTION-SHEET-SWIPE-CLOSE-001: #2159, #2230, #2231; MOBILE-INSETS-001: #2153).
 *
 * 1. Собственный лист «Modal + свой жест закрытия» вне владельца запрещён. Вторая
 *    копия (`TravelStatusButton`, #798) прожила без общего контракта три месяца:
 *    жест висел внутри Pressable и не доходил ни на iOS, ни на Android (#2230).
 * 2. Web-резерв под док исчезает там, где дока нет: корень помечает экран, CSS
 *    обнуляет `--mt-dock-h` на `body` (порталы Modal наследуют от body). Без этой
 *    пары лист и любой потребитель `useBottomChromeInset()` на экране без дока
 *    висят на высоту дока над краем (#2153).
 *
 * Страж судит код без комментариев и проверен на синтетическом нарушении.
 */
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIRS = ['app', 'components', 'screens', 'hooks']
const SHEET_OWNER = 'components/ui/BottomSheet.tsx'

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

/** Имена, импортированные из `react-native` (все объявления импорта файла). */
const reactNativeImports = (source: string): Set<string> => {
  const names = new Set<string>()
  const pattern = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]react-native['"]/g
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (name) names.add(name)
    }
  }
  return names
}

export const ownsModalWithOwnGesture = (source: string): boolean => {
  const names = reactNativeImports(stripComments(source))
  return names.has('Modal') && names.has('PanResponder')
}

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('нижний лист — один владелец', () => {
  it('страж видит синтетическую копию листа и не путает её с соседями', () => {
    expect(
      ownsModalWithOwnGesture("import {\n  Modal,\n  PanResponder,\n  View,\n} from 'react-native'\n"),
    ).toBe(true)
    expect(ownsModalWithOwnGesture("import { Modal, View } from 'react-native'\n")).toBe(false)
    expect(ownsModalWithOwnGesture("import { PanResponder, View } from 'react-native'\n")).toBe(false)
    expect(
      ownsModalWithOwnGesture("// import { Modal, PanResponder } from 'react-native'\nimport { View } from 'react-native'\n"),
    ).toBe(false)
  })

  it('Modal со своим жестом (PanResponder) есть только у components/ui/BottomSheet', () => {
    const owners = SRC_DIRS.flatMap((dir) => {
      const full = path.join(ROOT, dir)
      return fs.existsSync(full) ? walk(full) : []
    })
      .filter((file) => ownsModalWithOwnGesture(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))

    expect(owners).toEqual([SHEET_OWNER])
  })

  it('владелец держит все три контракта: старт-захват шапки, граница касаний вне Modal, отступ из общего резерва', () => {
    const source = stripComments(fs.readFileSync(path.join(ROOT, SHEET_OWNER), 'utf8'))
    expect(source).toMatch(/onStartShouldSetPanResponder:\s*\(\)\s*=>\s*true/)
    expect(source).toMatch(/onPanResponderTerminationRequest:\s*\(\)\s*=>\s*false/)
    expect(source).not.toMatch(/onStartShouldSetPanResponderCapture/)
    expect(source).toMatch(/testID="bottom-sheet-touch-boundary"/)
    expect(source).toMatch(/useBottomChromeInset\(\)/)
    expect(source).not.toMatch(/\?\s*5[68]\b/)
  })
})

describe('web-резерв под док исчезает на экране без дока (#2153)', () => {
  const layout = stripComments(fs.readFileSync(path.join(ROOT, 'app/_layout.tsx'), 'utf8'))
  const css = fs.readFileSync(path.join(ROOT, 'app/global.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it('корневой layout помечает экран без дока через dataSet (канал guard:web-style-channels)', () => {
    expect(layout).toMatch(/DOCK_OFF_DATASET\s*=\s*\{\s*mtDock:\s*'off'\s*\}/)
    expect(layout).toMatch(/isWeb\s*&&\s*!showFooter\s*\?\s*\{\s*dataSet:\s*DOCK_OFF_DATASET\s*\}\s*:\s*null/)
    expect(layout).not.toMatch(/data-mt-dock/)
  })

  it('global.css обнуляет --mt-dock-h на body внутри мобильного медиа-запроса, после объявления резерва', () => {
    const mobile = /@media \(max-width: 1279\.98px\) \{\s*:root \{\s*--mt-dock-h: calc\(56px \+ env\(safe-area-inset-bottom, 0px\)\);\s*\}\s*body:has\(\[data-mt-dock="off"\]\) \{\s*--mt-dock-h: 0px;\s*\}/
    expect(css).toMatch(mobile)
  })
})
