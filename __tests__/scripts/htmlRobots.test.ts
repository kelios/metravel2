const { isNoindex } = require('@/scripts/lib/htmlRobots')
const { isNoindex: descriptionIsNoindex } = require('@/scripts/lib/htmlMetaDescription')
const { questPageIsNoindex, questPageFromHtml } = require('@/scripts/lib/questPageDepth')

const cases: [string, string, boolean][] = [
  ['generated robots tag', '<meta name="robots" content="noindex, follow"/>', true],
  ['single quotes', "<meta name='robots' content='noindex, follow'>", true],
  ['reversed attributes', '<meta content="noindex" name="robots">', true],
  ['mixed quotes and case', '<META CONTENT=\'FOLLOW, NoInDeX\' NAME="RoBoTs">', true],
  ['whitespace and comma separators', '<meta name="robots" content="follow,\n\tnoindex  noarchive">', true],
  ['second robots tag', '<meta name="robots" content="index"><meta name="robots" content="noindex">', true],
  ['index after noindex', '<meta name="robots" content="noindex"><meta name="robots" content="index">', true],
  ['indexable page', '<meta name="robots" content="index, follow">', false],
  ['token prefix', '<meta name="robots" content="noindex-preview">', false],
  ['token suffix', '<meta name="robots" content="xnoindex">', false],
  ['different meta name', '<meta name="robots-extra" content="noindex">', false],
  ['description containing noindex', '<meta name="description" content="noindex">', false],
  ['missing content', '<meta name="robots"><meta name="description" content="noindex">', false],
  ['text outside robots tag', '<meta name="robots" content="index"><p>noindex</p>', false],
  ['no robots tag', '<html><head></head></html>', false],
]

describe('shared HTML robots detector', () => {
  it.each(cases)('%s', (_name, html, expected) => {
    expect(isNoindex(html)).toBe(expected)
    expect(descriptionIsNoindex(html)).toBe(expected)
    expect(questPageIsNoindex(html)).toBe(expected)
    expect(questPageFromHtml(html, '/quests/example').noindex).toBe(expected)
  })

  it('keeps both build checks on the same detector instead of independent copies', () => {
    expect(descriptionIsNoindex).toBe(isNoindex)
    expect(questPageIsNoindex).toBe(isNoindex)
  })
})
