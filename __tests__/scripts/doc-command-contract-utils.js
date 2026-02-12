const fs = require('fs')
const path = require('path')

const docsPath = path.resolve(process.cwd(), 'docs', 'TESTING.md')
const packageJsonPath = path.resolve(process.cwd(), 'package.json')
const DEFAULT_DOC_COMMAND_TEMPLATE = (command) => `- \`yarn ${command}\``

const readDocsAndScripts = () => {
  const markdown = fs.readFileSync(docsPath, 'utf8')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  return {
    markdown,
    scripts: packageJson?.scripts || {},
  }
}

const getDocsScope = ({
  markdown,
  scopeStart = '- Local helper commands:',
  scopeEnd = '  - In PR runs, CI manages a marker-based PR comment lifecycle for validator guard:',
}) => {
  const start = markdown.indexOf(scopeStart)
  if (start === -1) {
    throw new Error(`Docs scope start marker not found: ${scopeStart}`)
  }

  const end = markdown.indexOf(scopeEnd, start + scopeStart.length)
  if (end === -1) {
    throw new Error(`Docs scope end marker not found: ${scopeEnd}`)
  }

  return markdown.slice(start, end)
}

const assertDocCommandsSync = ({
  expectedCommands,
  scopeStart,
  scopeEnd,
  commandTemplate = DEFAULT_DOC_COMMAND_TEMPLATE,
}) => {
  const { markdown, scripts } = readDocsAndScripts()
  const scopedMarkdown = getDocsScope({
    markdown,
    scopeStart,
    scopeEnd,
  })

  expectedCommands.forEach((command) => {
    expect(typeof scripts[command]).toBe('string')
    expect(scripts[command].length).toBeGreaterThan(0)
    expect(scopedMarkdown).toContain(commandTemplate(command))
  })
}

module.exports = {
  DEFAULT_DOC_COMMAND_TEMPLATE,
  assertDocCommandsSync,
  getDocsScope,
}
