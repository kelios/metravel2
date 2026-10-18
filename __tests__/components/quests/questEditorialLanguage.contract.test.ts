import fs from 'fs'
import path from 'path'
import ts from 'typescript'

const root = path.resolve(__dirname, '../../..')
const surfaces = [
  ['components/quests/TravelsForQuestSection.tsx', 'heading'],
  ['components/quests/QuestCityLandingSections.tsx', 'overview|practice|paragraph.text|place.title|place.sentences'],
  ['components/quests/QuestForCityCard.tsx', 'quest.title|eyebrow'],
  ['components/quests/QuestFullMap.tsx', 'gp.titles|title'],
  ['components/quests/QuestLandingLayout.tsx', 'link.name|title|lead|children'],
  ['screens/tabs/QuestCard.tsx', 'quest.title|categoryLabel'],
] as const

it.each(surfaces)('#2482 %s never renders editorial fields as bare Text', (file, fields) => {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const bare: string[] = []
  let protectedCount = 0
  const fieldPattern = new RegExp(`\\b(?:${fields.replace(/\./g, '\\.')})\\b`)
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(source)
      const text = node.children.filter(ts.isJsxExpression).map((child) => child.getText(source)).join(' ')
      if (fieldPattern.test(text)) {
        if (tag === 'Text') bare.push(text)
        if (tag === 'QuestEditorialText') protectedCount += 1
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  expect(bare).toEqual([])
  expect(protectedCount).toBeGreaterThan(0)
})

it('#2482 shared travel and map popup consumers keep quest editorial rendering wired', () => {
  const travels = fs.readFileSync(path.join(root, 'components/quests/TravelsForQuestSection.tsx'), 'utf8')
  const popup = fs.readFileSync(path.join(root, 'components/MapPage/Map/createMapPopupComponent.tsx'), 'utf8')
  expect(travels).toContain('renderText={renderQuestEditorialText}')
  expect(popup).toContain('renderText={isQuest ? renderQuestEditorialText : undefined}')
})
