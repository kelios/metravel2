const fs = require('fs')
const path = require('path')
const { makeTempDir, removeDir, writeTextFile } = require('./cli-test-utils')
const { MODAL_FEEDBACK_ROOTS, TRANSIENT_MODALS, scanModalFeedback } = require('@/scripts/guard-modal-feedback')

const repoRoot = process.cwd()

describe('native modal feedback registry (#2440)', () => {
  let root: string
  beforeEach(() => {
    root = makeTempDir('modal-feedback-')
    for (const file of new Set([...MODAL_FEEDBACK_ROOTS, ...TRANSIENT_MODALS].map((entry: { file: string }) => entry.file))) {
      writeTextFile(path.join(root, file as string), fs.readFileSync(path.join(repoRoot, file as string), 'utf8'))
    }
  })
  afterEach(() => removeDir(root))

  it('covers retained native feedback layers in the real repository', () => {
    expect(scanModalFeedback(repoRoot)).toEqual([])
  })

  it.each(MODAL_FEEDBACK_ROOTS.map((entry: { file: string; visible: string }) => [entry.file, entry.visible]))(
    'rejects a missing retained host in %s', (file: string, visible: string) => {
      const abs = path.join(root, file)
      const text = fs.readFileSync(abs, 'utf8')
      writeTextFile(abs, text.replace(`<ModalToastHost visible={${visible}} />`, '{/* ModalToastHost is required, a comment cannot supply it. */}'))
      expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('needs one retained ModalToastHost')]))
    },
  )

  it('rejects mismatched visibility and a host outside the native Modal', () => {
    const file = MODAL_FEEDBACK_ROOTS[0].file
    const abs = path.join(root, file)
    const text = fs.readFileSync(abs, 'utf8')
    writeTextFile(abs, text.replace('<ModalToastHost visible={visible} />', '<ModalToastHost visible={false} />'))
    expect(scanModalFeedback(root).some((item: string) => item.includes('matching visible'))).toBe(true)
    writeTextFile(abs, `${text.replace('<ModalToastHost visible={visible} />', '')}\nconst orphanHost = <ModalToastHost visible={visible} />`)
    expect(scanModalFeedback(root).some((item: string) => item.includes('needs one retained ModalToastHost'))).toBe(true)
  })

  it('requires registration for a new native feedback consumer, including import aliases', () => {
    writeTextFile(path.join(root, 'components/NewModal.tsx'), `
      import { Modal as NativeModal } from 'react-native'
      import { showToast as notify } from '@/utils/toast'
      export const NewModal = () => <NativeModal visible><Button onPress={() => notify({ text1: 'Saved' })} /></NativeModal>
    `)
    expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('NewModal.tsx: native Modal visible=true uses feedback outside registry')]))
  })

  it('does not register ordinary native modals without feedback or proven web-only branches', () => {
    writeTextFile(path.join(root, 'components/Plain.tsx'), `import { Modal } from 'react-native'; const Plain = () => <Modal visible><Text>Read</Text></Modal>`)
    writeTextFile(path.join(root, 'components/Web.tsx'), `
      import { Modal, Platform } from 'react-native'
      import { showToast } from '@/utils/toast'
      const isWeb = Platform.OS === 'web'
      const Web = () => isWeb ? <Modal visible><Button onPress={() => showToast({})} /></Modal> : null
    `)
    expect(scanModalFeedback(root)).toEqual([])
  })

  it('does not let a temporary report sheet steal its retained parent host', () => {
    const file = 'components/safety/ReportReasonSheet.tsx'
    const abs = path.join(root, file)
    const text = fs.readFileSync(abs, 'utf8')
    writeTextFile(abs, `import ModalToastHost from '@/components/ui/ModalToastHost'\n${text.replace('</BottomSheet>', '<ModalToastHost visible={visible} /></BottomSheet>')}`)
    expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('transient feedback must remain')]))
  })

  it('requires registration for feedback in the shared sheet, including an aliased import', () => {
    writeTextFile(path.join(root, 'components/NewSheet.tsx'), `
      import Sheet from '@/components/ui/BottomSheet'
      import { showToast as notify } from '@/utils/toast'
      export const NewSheet = () => <Sheet visible title="Read" onClose={close}><Button onPress={() => notify({})} /></Sheet>
    `)
    expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('NewSheet.tsx: native Modal visible=true uses feedback outside registry')]))
  })

  it.each([
    'components/achievements/ShareBadgeSheet.tsx',
    'components/achievements/PeerBadgePickerSheet.tsx',
    'components/quests/ShareQuestResultSheet.tsx',
  ])('rejects a retained host moved into the constrained body of %s', (file: string) => {
    const abs = path.join(root, file)
    const text = fs.readFileSync(abs, 'utf8')
    writeTextFile(abs, text
      .replace('modalContent={<ModalToastHost visible={visible} />}', '')
      .replace('</ScrollView>', '<ModalToastHost visible={visible} /></ScrollView>'))
    expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('BottomSheet ModalToastHost must use modalContent outside the panel')]))
  })

  it('accepts a retained host in the modalContent slot of an aliased BottomSheet', () => {
    const file = 'components/achievements/ShareBadgeSheet.tsx'
    const abs = path.join(root, file)
    writeTextFile(abs, fs.readFileSync(abs, 'utf8')
      .replace('import BottomSheet from', 'import Sheet from')
      .replaceAll('<BottomSheet', '<Sheet').replaceAll('</BottomSheet>', '</Sheet>'))
    expect(scanModalFeedback(root)).toEqual([])
  })

  it('requires a new policy if export feedback starts before its temporary menu closes', () => {
    const file = 'components/quests/QuestFullMap.native.tsx'
    const abs = path.join(root, file)
    writeTextFile(abs, fs.readFileSync(abs, 'utf8').replace('setExportMenuVisible(false);\n                                void shareAsGPX();', 'void shareAsGPX();'))
    expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('shareAsGPX must close export menu')]))
  })

  it('requires status mutations to close their temporary BottomSheet before feedback', () => {
    const file = 'components/travel/TravelStatusButton.tsx'
    const abs = path.join(root, file)
    writeTextFile(abs, fs.readFileSync(abs, 'utf8').replaceAll('setModalOpen(false)', 'setModalOpen(true)'))
    expect(scanModalFeedback(root)).toEqual(expect.arrayContaining([expect.stringContaining('handleRemove must close status sheet before feedback')]))
  })
})
