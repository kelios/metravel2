import fs from 'fs'
import path from 'path'
import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('@/components/home/HomePageSkeleton', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { HomePageSkeleton: () => React.createElement(View, { testID: 'mock-home-page-skeleton' }) }
})

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const colors = {
  surface: '#fff',
  border: '#ddd',
  primaryDark: '#333',
  textMuted: '#666',
} as any

// #2087: на web слой скелетона главной недостижим (app/(tabs)/index.tsx,
// `shouldShowSkeleton`), поэтому web-вариант пустой и не тянет в веб-чанк главной
// 12 KB разметки `HomePageSkeleton`. Native-экран при этом обязан остаться.
describe('HomeSkeletonLayer', () => {
  it('native variant renders the skeleton layer', () => {
    const { HomeSkeletonLayer } = require('@/components/home/HomeSkeletonLayer')
    const screen = render(<HomeSkeletonLayer colors={colors} />)
    expect(screen.getByTestId('home-skeleton-layer')).toBeTruthy()
    expect(screen.getByTestId('mock-home-page-skeleton')).toBeTruthy()
  })

  it('web variant renders nothing', () => {
    const { HomeSkeletonLayer } = require('@/components/home/HomeSkeletonLayer.web')
    const screen = render(<HomeSkeletonLayer colors={colors} />)
    expect(screen.toJSON()).toBeNull()
  })

  it('web variant does not import the skeleton markup', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'components/home/HomeSkeletonLayer.web.tsx'), 'utf8')
    expect(source).not.toMatch(/from ['"][^'"]*HomePageSkeleton['"]/)
    expect(source).not.toMatch(/from ['"]react-native['"]/)
  })

  it('home route reaches the skeleton only through the platform-split layer', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'app/(tabs)/index.tsx'), 'utf8')
    expect(source).toContain("from '@/components/home/HomeSkeletonLayer'")
    expect(source).not.toMatch(/from ['"]@\/components\/home\/HomePageSkeleton['"]/)
  })
})
