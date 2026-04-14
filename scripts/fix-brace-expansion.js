#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

const candidatePaths = [
  'node_modules/brace-expansion/index.js',
  'node_modules/babel-plugin-module-resolver/node_modules/brace-expansion/index.js',
  'node_modules/glob/node_modules/brace-expansion/dist/commonjs/index.js',
  'node_modules/glob/node_modules/brace-expansion/dist/esm/index.js',
  'node_modules/@expo/fingerprint/node_modules/brace-expansion/dist/commonjs/index.js',
  'node_modules/@expo/fingerprint/node_modules/brace-expansion/dist/esm/index.js',
  'node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion/dist/commonjs/index.js',
  'node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion/dist/esm/index.js',
]

const legacyNeedle = `var incr = n.length == 3
      ? Math.abs(numeric(n[2]))
      : 1;`

const legacyReplacement = `${legacyNeedle}
    if (incr === 0) {
      incr = 1;
    }`

const modernNeedle =
  'let incr = n.length === 3 && n[2] !== undefined ? Math.abs(numeric(n[2])) : 1;'

const modernReplacement = `${modernNeedle}
            if (incr === 0) {
                incr = 1;
            }`

let patchedCount = 0

for (const relativePath of candidatePaths) {
  const absolutePath = path.join(projectRoot, relativePath)
  if (!fs.existsSync(absolutePath)) {
    continue
  }

  const source = fs.readFileSync(absolutePath, 'utf8')
  if (source.includes('if (incr === 0) {')) {
    continue
  }

  let next = source
  if (next.includes(legacyNeedle)) {
    next = next.replace(legacyNeedle, legacyReplacement)
  } else if (next.includes(modernNeedle)) {
    next = next.replace(modernNeedle, modernReplacement)
  } else {
    continue
  }

  if (next !== source) {
    fs.writeFileSync(absolutePath, next, 'utf8')
    patchedCount += 1
  }
}

if (patchedCount > 0) {
  console.log(`✓ Patched brace-expansion zero-step guard in ${patchedCount} file(s)`)
}
