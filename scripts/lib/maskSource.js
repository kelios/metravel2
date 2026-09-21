'use strict'

// Moved out of `scripts/guard-cli-contract.js` (#2012) so a second guard reads
// source through the same scanner instead of a fourth hand-rolled copy. The
// examples below are the cli-contract rules it was written for.

// A `/` in code position starts a regex only after something an expression can
// follow — an operator, an opening bracket, a keyword. After a value it is division.
const REGEX_PRECEDERS = '=(:,!&|?{[;'
const startsRegexLiteral = (emitted) => {
  const before = emitted.trimEnd()
  const previous = before.at(-1) || ''
  const tail = before.slice(-8)
  return (
    !previous ||
    REGEX_PRECEDERS.includes(previous) ||
    tail.endsWith('=>') ||
    /\b(?:case|return|throw|typeof|void|yield)$/.test(tail)
  )
}

// The one scanner the source-reading guards share (`guard-cli-contract.js`,
// `guard-web-deferred-loading.js`). It blanks what is not
// executable code — comments always, and with `literals: true` the contents of
// string, template and regex literals too — writing one space per hidden
// character and keeping every newline, so offsets and line numbers still match
// the file on disk.
//
// Two readings come out of it, and both rules need their own. Rules that read
// values (`selection: 'rows'`, `argv.includes('--all')`) need the literals
// intact. Rules that look for a call need them blanked: `parseCliArgs(`,
// `runCli(`, `requireNonEmptySelection(` or `requireNoBatchFailures(`
// inside a USAGE template, a regex or any other string is prose about the call,
// not the call — and every
// covered script writes its USAGE as a multi-line template, so that shape is the
// natural one, not a contrived one.
//
// One scanner rather than three is the point. The bypasses closed here were all
// the same defect: three hand-rolled scanners disagreeing about where a literal
// ends, so a mention was code to one of them and prose to another.
//
// Template interpolations stay code — `${…}` is real JavaScript and can hold the
// very call a rule is looking for.
const maskSource = (source, { literals = false } = {}) => {
  const text = String(source || '')
  let out = ''
  let i = 0

  const keep = (count = 1) => {
    out += text.slice(i, i + count)
    i += count
  }
  const hide = (count = 1) => {
    for (let n = 0; n < count && i < text.length; n++, i++) out += text[i] === '\n' ? '\n' : ' '
  }
  // Inside a literal: hidden when the caller asked for the masked reading, kept
  // as written otherwise.
  const step = (count = 1) => (literals ? hide(count) : keep(count))

  // `depth` counts braces open in the current code context. A `}` at depth 0
  // closes the `${…}` that opened this context and hands the scan back to its
  // template.
  const contexts = [{ template: false, depth: 0 }]

  while (i < text.length) {
    const context = contexts[contexts.length - 1]
    const char = text[i]
    const next = text[i + 1]

    if (context.template) {
      if (char === '\\' && next !== undefined) step(2)
      else if (char === '`') {
        contexts.pop()
        keep()
      } else if (char === '$' && next === '{') {
        contexts.push({ template: false, depth: 0 })
        keep(2)
      } else step()
      continue
    }

    if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') hide()
      continue
    }

    if (char === '/' && next === '*') {
      hide(2)
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) hide()
      hide(2)
      continue
    }

    if (char === "'" || char === '"') {
      keep()
      while (i < text.length && text[i] !== char && text[i] !== '\n') {
        if (text[i] === '\\' && text[i + 1] !== undefined) step(2)
        else step()
      }
      if (text[i] === char) keep()
      continue
    }

    if (char === '`') {
      contexts.push({ template: true, depth: 0 })
      keep()
      continue
    }

    if (char === '/' && startsRegexLiteral(out)) {
      keep()
      let characterClass = false
      while (i < text.length && text[i] !== '\n') {
        if (text[i] === '\\' && text[i + 1] !== undefined) {
          step(2)
          continue
        }
        if (text[i] === '[') characterClass = true
        else if (text[i] === ']') characterClass = false
        else if (text[i] === '/' && !characterClass) break
        step()
      }
      if (text[i] === '/') keep()
      continue
    }

    if (char === '{') {
      context.depth++
      keep()
      continue
    }
    if (char === '}') {
      if (context.depth === 0 && contexts.length > 1) contexts.pop()
      else context.depth--
      keep()
      continue
    }

    keep()
  }

  return out
}

module.exports = { maskSource }
