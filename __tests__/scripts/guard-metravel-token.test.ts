const { inspectSource } = require('../../scripts/guard-metravel-token')

describe('MeTravel token reader governance', () => {
  test.each([
    "fs.readFileSync(path.join(os.homedir(), '.metravel_token'), 'utf8')",
    "const name = '.metravel' + '_token'; const file = path.join(home, name); fs.promises.readFile(file)",
    "import { readFile as get } from 'node:fs/promises'; get('.secrets/mcp_token.json')",
    "const { readFileSync: get } = require('fs'); get('.metravel_editor_token')",
    "function loadToken(file) { return fs.readFileSync(file) }; loadToken('.metravel_token')",
    "execFile" + "Sync('node', ['scripts/get-quest-token.js']).toString()",
  ])('forbids executable reader %s', (source) => {
    expect(inspectSource(source, 'scripts/example.js')).not.toEqual([])
  })
  test.each([
    "// fs.readFileSync('.metravel_token')\nconst usage = 'file ~/.metravel_token';",
    "const session = createToolSession({ profile: 'owner', expectedUserId: 1 }); session.request('/api/x/')",
    "fs.readFileSync('article.json', 'utf8')",
  ])('allows comments, guidance and ordinary data %s', (source) => {
    expect(inspectSource(source, 'scripts/example.js')).toEqual([])
  })
  it('includes Python and documented generated credential argv', () => {
    expect(inspectSource("p = os.path.expanduser('~/.metravel_token'); open(p).read()", 'skill.py')).not.toEqual([])
    expect(inspectSource('TOKEN=$(node scripts/get-quest-token.js)', 'skill.md')).not.toEqual([])
    expect(inspectSource('"""file ~/.metravel_token is historical prose"""', 'skill.py')).toEqual([])
  })
})
