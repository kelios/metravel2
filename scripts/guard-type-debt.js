#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// v2: `asAny` разделён на styleCast (безвредные RN-Web style-касты) и logicCast
// (риск — DTO/логика). Форма baseline изменилась → contractVersion bump. (FE-ARCH T1)
const CONTRACT_VERSION = 2
const SCAN_DIRS = Object.freeze([
  'api',
  'app',
  'components',
  'context',
  'hooks',
  'screens',
  'services',
  'stores',
  'utils',
])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const METRICS = Object.freeze(['styleCast', 'logicCast', 'tsIgnore', 'tsExpectError', 'eslintDisable'])

const emptyCounts = () => ({
  styleCast: 0,
  logicCast: 0,
  tsIgnore: 0,
  tsExpectError: 0,
  eslintDisable: 0,
})

// Файлы-стили целиком в style-контексте.
const STYLE_FILE_PATTERN = /(?:\.styles|Styles)\.tsx?$/

// `x as any`, стоящий в style-контексте, — шум (RN-Web не типизирует web-CSS
// свойства). Признаём styleCast по строке каста: вендорный префикс, обращение к
// styles/StyleSheet/style=, либо CSS-свойство в форме ключа объекта (`prop:`) —
// форма ключа отсекает логические совпадения (`filter(`, переменную `position`).
const STYLE_VENDOR_PATTERN = /\b(?:Webkit|Moz|ms)[A-Z][A-Za-z]*/
const STYLE_CONTEXT_PATTERN = /\bstyle\s*=\s*\{|\bstyles?\s*[.:]|\bStyleSheet\b|ContainerStyle\b|\bcontentContainerStyle\b|\bsrOnly\b|\bvisuallyHidden\b/
const STYLE_CSS_KEY_PATTERN = new RegExp(
  '\\b(?:' + [
    'cursor', 'userSelect', 'pointerEvents', 'whiteSpace', 'textOverflow',
    'wordBreak', 'wordWrap', 'overflowX', 'overflowY', 'overflow', 'overflowWrap',
    'boxShadow', 'boxSizing', 'transitionProperty', 'transitionDuration',
    'transitionTimingFunction', 'transitionDelay', 'transition', 'transformOrigin',
    'transformStyle', 'transform', 'willChange', 'backdropFilter', 'filter',
    'appearance', 'objectFit', 'objectPosition', 'scrollBehavior', 'scrollSnapType',
    'scrollSnapAlign', 'touchAction', 'gridTemplateColumns', 'gridTemplateRows',
    'gridTemplateAreas', 'gridColumn', 'gridRow', 'gridAutoFlow', 'gridAutoRows',
    'gridAutoColumns', 'gridGap', 'rowGap', 'columnGap', 'gap', 'display', 'position',
    'flexBasis', 'flexGrow', 'flexShrink', 'flexDirection', 'flexWrap', 'flex',
    'maxWidth', 'minWidth', 'maxHeight', 'minHeight', 'width', 'height',
    'fontWeight', 'fontSize', 'fontFamily', 'fontStyle', 'lineHeight', 'letterSpacing',
    'inset', 'clipPath', 'maskImage', 'mixBlendMode', 'backgroundClip',
    'textFillColor', 'textDecorationLine', 'textDecorationStyle', 'textDecoration',
    'lineClamp', 'fontVariantNumeric', 'fontVariant', 'fontFeatureSettings',
    'animationName', 'animationDuration', 'animation', 'outlineStyle', 'outlineWidth',
    'outlineColor', 'outlineOffset', 'outline', 'zIndex', 'aspectRatio',
    'verticalAlign', 'visibility', 'resize', 'perspective', 'isolation',
  ].join('|') + ')\\s*:',
)

// hintText — полный текст каста (`X as any`), включая многострочные style-объекты,
// чтобы CSS-ключи внутри `({ display:'grid', ... }) as any` попадали в styleCast.
const isStyleCast = (hintText, filePath) =>
  STYLE_FILE_PATTERN.test(filePath) ||
  STYLE_VENDOR_PATTERN.test(hintText) ||
  STYLE_CONTEXT_PATTERN.test(hintText) ||
  STYLE_CSS_KEY_PATTERN.test(hintText)

const addCounts = (target, counts) => {
  for (const metric of METRICS) target[metric] += counts[metric]
  return target
}

const getScriptKind = (filePath) => {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js': return ts.ScriptKind.JS
    case '.jsx': return ts.ScriptKind.JSX
    case '.tsx': return ts.ScriptKind.TSX
    default: return ts.ScriptKind.TS
  }
}

const countMatches = (content, pattern) => [...String(content).matchAll(pattern)].length

const countTypeDebt = (content, filePath = 'source.ts', logicSink = null) => {
  const source = String(content)
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  )
  const lines = source.split('\n')
  let styleCast = 0
  let logicCast = 0

  const typeContainsAny = (typeNode) => {
    let containsAny = false
    const inspect = (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        containsAny = true
        return
      }
      ts.forEachChild(node, inspect)
    }
    inspect(typeNode)
    return containsAny
  }

  const visit = (node) => {
    if (ts.isAsExpression(node) && typeContainsAny(node.type)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      // Строка каста несёт ключ свойства (`fontWeight: x as any`), текст узла —
      // тело многострочного style-объекта (`({ display:'grid', ... }) as any`).
      const hintText = `${lines[line] ?? ''}\n${node.getText(sourceFile)}`
      if (isStyleCast(hintText, filePath)) {
        styleCast += 1
      } else {
        logicCast += 1
        if (logicSink) logicSink.push({ file: filePath, line: line + 1, code: (lines[line] ?? '').trim() })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return {
    styleCast,
    logicCast,
    tsIgnore: countMatches(content, /@ts-ignore\b/g),
    tsExpectError: countMatches(content, /@ts-expect-error\b/g),
    eslintDisable: countMatches(content, /eslint-disable(?:-next-line|-line)?\b/g),
  }
}

const collectSourceFiles = (root) => {
  const files = []

  const walk = (absoluteDir) => {
    if (!fs.existsSync(absoluteDir)) return
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(path.relative(root, absolutePath).split(path.sep).join('/'))
      }
    }
  }

  for (const dir of SCAN_DIRS) walk(path.join(root, dir))
  return files.sort((left, right) => left.localeCompare(right))
}

const scanTypeDebt = (root) => {
  const files = {}
  const domains = {}
  const totals = emptyCounts()

  for (const relativePath of collectSourceFiles(root)) {
    const counts = countTypeDebt(
      fs.readFileSync(path.join(root, relativePath), 'utf8'),
      relativePath,
    )
    if (!METRICS.some((metric) => counts[metric] > 0)) continue

    files[relativePath] = counts
    const domain = relativePath.split('/')[0]
    domains[domain] ??= emptyCounts()
    addCounts(domains[domain], counts)
    addCounts(totals, counts)
  }

  return { domains, files, totals }
}

const createBaseline = (root) => {
  const scan = scanTypeDebt(root)
  return {
    contractVersion: CONTRACT_VERSION,
    scope: [...SCAN_DIRS],
    totals: scan.totals,
    domains: scan.domains,
    files: scan.files,
  }
}

const compareToBaseline = (current, baseline) => {
  if (baseline?.contractVersion !== CONTRACT_VERSION) {
    throw new Error(`unsupported baseline contractVersion=${String(baseline?.contractVersion)}`)
  }
  if (JSON.stringify(baseline.scope) !== JSON.stringify(SCAN_DIRS)) {
    throw new Error('baseline scope does not match the guard scope')
  }

  const violations = []
  const compareCounts = (scope, name, actual = emptyCounts(), allowed = emptyCounts()) => {
    for (const metric of METRICS) {
      if (actual[metric] > allowed[metric]) {
        violations.push({
          scope,
          name,
          metric,
          baseline: allowed[metric],
          current: actual[metric],
        })
      }
    }
  }

  for (const [domain, counts] of Object.entries(current.domains)) {
    compareCounts('domain', domain, counts, baseline.domains?.[domain])
  }
  for (const [file, counts] of Object.entries(current.files)) {
    compareCounts('file', file, counts, baseline.files?.[file])
  }

  return violations.sort((left, right) =>
    left.scope.localeCompare(right.scope) ||
    left.name.localeCompare(right.name) ||
    left.metric.localeCompare(right.metric))
}

const parseArgs = (argv) => {
  const args = {
    root: process.cwd(),
    baseline: 'scripts/type-debt-baseline.json',
    update: false,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--root' && argv[index + 1]) {
      args.root = path.resolve(argv[index + 1])
      index += 1
    } else if (token === '--baseline' && argv[index + 1]) {
      args.baseline = argv[index + 1]
      index += 1
    } else if (token === '--update') {
      args.update = true
    } else if (token === '--json') {
      args.json = true
    }
  }

  return args
}

const resolveBaselinePath = (root, requestedPath) =>
  path.isAbsolute(requestedPath) ? requestedPath : path.resolve(root, requestedPath)

const run = (args = parseArgs([])) => {
  const baselinePath = resolveBaselinePath(args.root, args.baseline)

  if (args.update) {
    const baseline = createBaseline(args.root)
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    process.stdout.write(`Type-debt baseline updated: ${path.relative(args.root, baselinePath)}.\n`)
    process.stdout.write(`${JSON.stringify(baseline.totals)}\n`)
    return 0
  }

  if (!fs.existsSync(baselinePath)) {
    process.stderr.write(`Type-debt guard failed: baseline not found at ${baselinePath}.\n`)
    return 1
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  const current = scanTypeDebt(args.root)
  const violations = compareToBaseline(current, baseline)
  const result = {
    contractVersion: CONTRACT_VERSION,
    totals: current.totals,
    violationCount: violations.length,
    violations,
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (violations.length === 0) {
    process.stdout.write(`Type-debt guard passed. totals=${JSON.stringify(current.totals)}\n`)
  } else {
    process.stderr.write(`Type-debt guard found ${violations.length} increase(s):\n`)
    for (const violation of violations) {
      process.stderr.write(
        `- ${violation.scope}=${violation.name} metric=${violation.metric} ` +
        `baseline=${violation.baseline} current=${violation.current}\n`,
      )
    }
    process.stderr.write('Review the new debt, reduce it, or explicitly update the baseline.\n')
  }

  return violations.length === 0 ? 0 : 1
}

if (require.main === module) {
  process.exitCode = run(parseArgs(process.argv.slice(2)))
}

module.exports = {
  CONTRACT_VERSION,
  METRICS,
  SCAN_DIRS,
  collectSourceFiles,
  compareToBaseline,
  countTypeDebt,
  createBaseline,
  emptyCounts,
  parseArgs,
  run,
  scanTypeDebt,
}
