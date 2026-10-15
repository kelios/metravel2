import path from 'node:path'
import { makeTempDir, removeDir, runNodeCli, writeTextFile } from './cli-test-utils'

const { findViolationsInSource, collectViolations } = require('../../scripts/guard-sheet-backdrop')

const file = 'components/LegacySheet.tsx'
const legacy = `import { Pressable } from 'react-native';
  const Sheet = () => <Pressable onPress={close} accessibilityLabel="Close">
    <View><Pressable onPress={() => { /* swallow panel touches */ }}><Button /></Pressable></View>
  </Pressable>`

describe('sheet backdrop ownership (#2434)', () => {
  it('rejects the wrapping backdrop using syntax rather than style names or formatting', () => {
    expect(findViolationsInSource(file, legacy)).toHaveLength(1)
    expect(findViolationsInSource(file, legacy.replace('() => { /* swallow panel touches */ }', 'function () { }'))).toHaveLength(1)
    expect(findViolationsInSource(file, legacy.replaceAll('Pressable', 'Touch').replace('{ Touch }', '{ Pressable as Touch }'))).toHaveLength(1)
    expect(findViolationsInSource(file, legacy.replace("import { Pressable }", 'import * as RN').replaceAll('<Pressable', '<RN.Pressable').replaceAll('</Pressable', '</RN.Pressable'))).toHaveLength(1)
  })

  it('accepts a sibling backdrop and real nested actions; ignores comments and literals', () => {
    expect(findViolationsInSource(file, `import { Pressable } from 'react-native';
      const Sheet = () => <View><Pressable onPress={close} /><View><Pressable onPress={submit} /></View></View>`)).toEqual([])
    expect(findViolationsInSource(file, legacy.replace('() => { /* swallow panel touches */ }', '() => submit()'))).toEqual([])
    expect(findViolationsInSource(file, `// ${legacy.replaceAll('\n', '\n// ')}\nconst sample = 'onPress={() => {}}'`)).toEqual([])
    expect(findViolationsInSource('components/ui/BottomSheet.tsx', legacy)).toEqual([])
  })

  it('finds an added violation in a project tree and clears when converted to siblings', () => {
    const root = makeTempDir('sheet-backdrop-')
    try {
      writeTextFile(path.join(root, file), legacy)
      expect(collectViolations(root)).toHaveLength(1)
      writeTextFile(path.join(root, file), `import { Pressable } from 'react-native';
        const Sheet = () => <View><Pressable onPress={close} /><View><Button /></View></View>`)
      expect(collectViolations(root)).toEqual([])
    } finally { removeDir(root) }
  })

  it('is included in lint and the real repository has no wrapping backdrop panels', () => {
    const pkg = require('../../package.json')
    expect(pkg.scripts.lint).toContain('npm run guard:sheet-backdrop')
    expect(pkg.scripts['guard:sheet-backdrop']).toBe('node scripts/guard-sheet-backdrop.js')
    expect(collectViolations()).toEqual([])
    const result = runNodeCli(['scripts/guard-sheet-backdrop.js'])
    expect(result.status).toBe(0)
  })
})
