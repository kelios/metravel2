const fs = require('fs')
const path = require('path')

const VALIDATE_SCRIPT_PATTERN = /^validate-.*\.js$/
const LITERAL_CODE_PATTERN = /code:\s*'([A-Z][A-Z0-9_]+)'/g

const getValidateScriptFiles = () => {
  const scriptsDir = path.resolve(process.cwd(), 'scripts')
  return fs.readdirSync(scriptsDir)
    .filter((entry) => VALIDATE_SCRIPT_PATTERN.test(entry))
    .map((entry) => path.join(scriptsDir, entry))
}

describe('validator error-code centralization guard', () => {
  it('does not allow literal error-code strings in validate scripts', () => {
    const offenders = []

    for (const filePath of getValidateScriptFiles()) {
      const content = fs.readFileSync(filePath, 'utf8')
      const matches = [...content.matchAll(LITERAL_CODE_PATTERN)]
      if (matches.length === 0) continue

      offenders.push({
        filePath,
        codes: matches.map((match) => match[1]),
      })
    }

    expect(offenders).toEqual([])
  })
})
