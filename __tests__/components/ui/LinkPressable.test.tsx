import fs from 'fs'
import path from 'path'
import React from 'react'
import ts from 'typescript'
import { Text } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import LinkPressable from '@/components/ui/LinkPressable'

// Native: Link (Slot) сначала зовёт `onPress` ребёнка, потом свою навигацию, если
// событие не отменено (`shouldHandleMouseEvent` вне web — `!defaultPrevented`).
const mockPush = jest.fn()
const mockLinkTo = jest.fn()
jest.mock('expo-router', () => {
  const ReactLib = require('react')
  return {
    router: { push: (...args: unknown[]) => mockPush(...args) },
    Link: ({ children, href }: any) => {
      const child = ReactLib.Children.only(children)
      return ReactLib.cloneElement(child, {
        href,
        role: 'link',
        onPress: (event: any) => {
          child.props.onPress?.(event)
          if (!event?.defaultPrevented) mockLinkTo(href)
        },
      })
    },
  }
})

// RNTL копирует пропсы события в своё, поэтому флаг ставится на `this`, а не замыканием.
const pressEvent = () => ({
  defaultPrevented: false,
  preventDefault(this: { defaultPrevented: boolean }) {
    this.defaultPrevented = true
  },
})

describe('LinkPressable on native (#2901)', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockLinkTo.mockClear()
  })

  it('keeps Link navigation and calls the caller once, without its own router push', async () => {
    const onPress = jest.fn()
    const screen = await render(
      <LinkPressable href="/search" onPress={onPress} testID="link" style={[{ borderWidth: 1 }, { padding: 4 }]}>
        <Text>x</Text>
      </LinkPressable>,
    )
    const link = screen.getByTestId('link')
    expect(link.props.style).toEqual({ borderWidth: 1, padding: 4 })
    await fireEvent.press(link, pressEvent())
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(mockLinkTo).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('lets the caller cancel Link navigation with preventDefault', async () => {
    const screen = await render(
      <LinkPressable href="/export" onPress={(event) => event.preventDefault()} testID="link">
        <Text>x</Text>
      </LinkPressable>,
    )
    await fireEvent.press(screen.getByTestId('link'), pressEvent())
    expect(mockLinkTo).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

// Guard: прямой ребёнок `Link asChild` — Pressable/Touchable* — на web теряет SPA-переход
// (react-native-web затирает `onClick` Link). Такие ссылки — только через LinkPressable.
const ROOT = path.resolve(__dirname, '../../..')
const SCAN_DIRS = ['components', 'app']
const OWNER = path.join('components', 'ui', 'LinkPressable.tsx')
const PRESSABLE_TAG = /^(Pressable|Touchable\w*)$/

const tagName = (node: ts.Node): string | null => {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText()
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText()
  return null
}

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node

function findLinkAsChildPressables(fileName: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const pressableVars = new Set<string>()
  const links: ts.JsxElement[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const tag = tagName(unwrap(node.initializer))
      if (tag && PRESSABLE_TAG.test(tag)) pressableVars.add(node.name.text)
    }
    if (
      ts.isJsxElement(node)
      && node.openingElement.tagName.getText() === 'Link'
      && node.openingElement.attributes.properties.some(
        (attr) => ts.isJsxAttribute(attr) && attr.name.getText() === 'asChild',
      )
    ) {
      links.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const violations: string[] = []
  for (const link of links) {
    const child = link.children.find((node) => !(ts.isJsxText(node) && node.containsOnlyTriviaWhiteSpaces))
    if (!child) continue
    const tag = tagName(child)
    const viaVariable = ts.isJsxExpression(child) && child.expression && ts.isIdentifier(child.expression)
      && pressableVars.has(child.expression.text)
    if ((tag && PRESSABLE_TAG.test(tag)) || viaVariable) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(link.getStart())
      violations.push(`${fileName}:${line + 1}`)
    }
  }
  return violations
}

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listSources(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })

describe('Link asChild with a Pressable child (#2901 guard)', () => {
  it('detects the pattern, directly and through a variable', () => {
    expect(findLinkAsChildPressables('a.tsx', `
      const a = <Link href="/x" asChild onPress={f}>
        <Pressable><Text /></Pressable>
      </Link>
    `)).toEqual(['a.tsx:2'])
    expect(findLinkAsChildPressables('b.tsx', `
      const card = (<Pressable />)
      const b = <Link href="/x" asChild>{card}</Link>
    `)).toEqual(['b.tsx:3'])
    expect(findLinkAsChildPressables('c.tsx', `
      const c = <Link href="/x" asChild><Text>x</Text></Link>
    `)).toEqual([])
  })

  it('has no call sites outside LinkPressable', () => {
    const violations = SCAN_DIRS.flatMap((dir) => listSources(path.join(ROOT, dir)))
      .map((file) => path.relative(ROOT, file))
      .filter((file) => file !== OWNER)
      .flatMap((file) => {
        const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
        return source.includes('asChild') ? findLinkAsChildPressables(file, source) : []
      })
    expect(violations).toEqual([])
  })
})
