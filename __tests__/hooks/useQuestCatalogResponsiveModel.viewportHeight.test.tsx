// #1826: экран каталога квестов намеренно отказался от `useResponsive()` ради
// ввода в поиске — а модель каталога звала его же и возвращала подписку на
// высоту обратно. На мобильном вебе высота меняется покадрово от клавиатуры и
// адресной строки, поэтому каждая такая подписка в дереве каталога = ре-рендер
// каталога на кадр. Набор держит и поведение модели, и состав дерева.

import fs from 'node:fs'
import path from 'node:path'
import { Dimensions } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel'

const setViewport = (width: number, height: number) => {
  act(() => {
    Dimensions.set({
      window: { width, height, scale: 2, fontScale: 1 },
      screen: { width, height, scale: 2, fontScale: 1 },
    })
  })
}

describe('#1826 модель каталога не подписана на высоту вьюпорта', () => {
  it('не перерисовывает потребителя на изменение одной высоты', () => {
    setViewport(1440, 900)
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useQuestCatalogResponsiveModel(177)
    })

    const initialRenders = renders
    const initialModel = result.current

    // Клавиатура на мобильном вебе: ширина та же, высота другая.
    setViewport(1440, 500)
    expect({ renders: renders - initialRenders, model: result.current }).toEqual({
      renders: 0,
      model: initialModel,
    })

    // Ширина меняется — модель обязана пересчитаться.
    setViewport(390, 500)
    expect(renders).toBeGreaterThan(initialRenders)
    expect(result.current.isMobile).toBe(true)
  })
})

describe('#1826 дерево каталога квестов не подписано на полный снимок вьюпорта', () => {
  // Экран, панель, сайдбар, карточка, SEO-блок и модель: любой из них,
  // подписавшись на `useResponsive()`, вернул бы ре-рендер всего каталога на
  // изменение высоты — ровно то, от чего экран уже отказывался.
  const CATALOG_TREE = [
    'screens/tabs/QuestsScreen.tsx',
    'screens/tabs/QuestsContentPanel.tsx',
    'screens/tabs/QuestsSidebar.tsx',
    'screens/tabs/QuestCard.tsx',
    'screens/tabs/QuestsSeoIntroFaq.tsx',
    'hooks/useQuestCatalogResponsiveModel.ts',
  ]

  // Комментарии из проверки убираются: в них имя снятого хука как раз и должно
  // остаться — объяснением, почему его тут больше нет.
  const withoutComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('никто в дереве не зовёт useResponsive', () => {
    const offenders = CATALOG_TREE.filter((file) => {
      const source = withoutComments(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'))
      return /(?<![A-Za-z0-9_])useResponsive\s*\(/.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('проверка отличает вызов от упоминания в комментарии', () => {
    expect(withoutComments("// useResponsive()\nconst x = 1")).not.toMatch(/useResponsive\s*\(/)
    expect(withoutComments('const { width } = useResponsive()')).toMatch(/useResponsive\s*\(/)
  })

  it('перечисляет существующие файлы, а не пустоту', () => {
    const missing = CATALOG_TREE.filter((file) => !fs.existsSync(path.resolve(process.cwd(), file)))
    expect(missing).toEqual([])
  })
})
