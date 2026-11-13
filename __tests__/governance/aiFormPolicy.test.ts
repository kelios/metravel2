import fs from 'node:fs'
import path from 'node:path'
import { parseSync } from '@babel/core'

import * as formPolicy from '@/constants/aiFormPolicy'
import * as featurePolicy from '@/api/aiAssist/policy'
import { normalizeMapIntentQuery } from '@/api/aiMapIntent'
import { normalizeTagSuggestionText, normalizeTagSuggestions } from '@/api/aiTagSuggestions'

it('keeps the neutral wire contract free of imports and feature side effects', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../constants/aiFormPolicy.ts'), 'utf8')
  const ast = parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ['typescript'] } })!
  expect(ast.program.body.length).toBeGreaterThan(0)
  for (const node of ast.program.body) {
    expect(node.type).toBe('ExportNamedDeclaration')
    expect(node).toMatchObject({ source: null })
    expect('declaration' in node && node.declaration).toBeTruthy()
  }
  for (const key of Object.keys(formPolicy) as Array<keyof typeof formPolicy>) {
    expect(featurePolicy[key]).toBe(formPolicy[key])
  }
})

it('retains synchronous normalization limits and field values', () => {
  expect(normalizeMapIntentQuery(' x '.repeat(1000))).toHaveLength(formPolicy.AI_MAP_INTENT_MAX_QUERY_CHARS)
  expect(typeof normalizeTagSuggestionText(' x '.repeat(5000))).toBe('string')
  expect(normalizeTagSuggestionText('x'.repeat(5000))).toHaveLength(formPolicy.AI_TAG_SUGGEST_MAX_TEXT_CHARS)
  expect(Object.keys(normalizeTagSuggestions({}))).toEqual([...formPolicy.AI_TAG_SUGGEST_FIELDS, 'confidence', 'degraded'])
})
