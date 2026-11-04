/* global require, module, __dirname, process */

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const isPrompt = (file) => /^docs\/.*PROMPTS\.md$/i.test(file)
  || /^assets\/(?:.*\/)?PROMPT\.md$/i.test(file)

const trackedPrompts = (root) => new Set(
  execFileSync('git', ['ls-files', '-z', '--cached', '--', 'docs', 'assets'], {
    cwd: root, encoding: 'utf8',
  }).split('\0').filter(isPrompt),
)

function* localPrompts(root, dir, tracked) {
  if (!fs.existsSync(path.join(root, dir))) return
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`
    if (entry.isDirectory()) yield* localPrompts(root, file, tracked)
    else if (entry.isFile() && isPrompt(file) && !tracked.has(file)) yield file
  }
}

function auditContentPrompts(root, local = false) {
  const tracked = trackedPrompts(root)
  const files = local ? [...localPrompts(root, 'docs', tracked), ...localPrompts(root, 'assets', tracked)] : [...tracked]
  const errors = []
  for (const file of files.sort()) {
    const target = path.join(root, file)
    const fail = (message) => errors.push(`${file}: ${message}`)
    if (!fs.lstatSync(target, { throwIfNoEntry: false })?.isFile()) {
      fail('expected a regular prompt file')
      continue
    }
    const prompt = fs.readFileSync(target, 'utf8')
    if (/\[(?:TODO|FIXME|TBD)\b|\b(?:TODO|FIXME|TBD):|Complete and informative explanation/i.test(prompt)) {
      fail('contains unfinished prompt scaffolding')
    }
    if (/CLAUDE\.md|\.claude\/skills/i.test(prompt)) {
      fail('references a model-specific legacy instruction instead of a canonical project source')
    }
    if (file.startsWith('assets/')) {
      const linksCanonicalSpec = /docs\/[^\s`]*PROMPTS\.md/i.test(prompt)
      const hasSelfContainedContract = /Use case:/i.test(prompt) && /Asset type:/i.test(prompt) && /Constraints:/i.test(prompt)
      if (!linksCanonicalSpec && !hasSelfContainedContract) fail('missing canonical docs/*PROMPTS.md reference or self-contained prompt contract')
      if (!/```[\s\S]+```/.test(prompt)) fail('missing fenced exact prompt')
    }
  }
  return { count: files.length, errors }
}

if (require.main === module) {
  const local = process.argv.includes('--local')
  const { count, errors } = auditContentPrompts(path.resolve(__dirname, '../../../..'), local)
  const mode = local ? 'local' : 'tracked'
  if (errors.length) {
    console.error(`content-prompt-audit (${mode}): failed\n${errors.join('\n')}`)
    process.exitCode = 1
  } else {
    console.info(`content-prompt-audit (${mode}): passed (${count} prompt files)`)
  }
}

module.exports = { auditContentPrompts }
