import { useMemo } from 'react'
import { Platform } from 'react-native'
import { useResponsive } from '@/hooks/useResponsive'

export type QuestWizardResponsiveModel = {
  screenW: number
  screenH: number
  isMobile: boolean
  isSmallScreen: boolean
  compactNav: boolean
  wideDesktop: boolean
  compactDesktopLayout: boolean
  useWideInlineLayout: boolean
  useWideExcursionsSidebar: boolean
  sidebarWidth: number
  mapPanelWidth: number
  answerPaneWidth: number
}

export function useQuestWizardResponsiveModel() {
  // `clientOnly` обязателен: без него первый кадр визарда считается на
  // `SSR_SNAPSHOT = {width: 0}` (`hooks/useResponsive.ts:166,265`), то есть по
  // мобильной ветке — `isMobile`, `compactNav` и `screenW < 600` истинны при
  // любой реальной ширине. Следующий кадр приходит с настоящей шириной и
  // перекладывает шапку:
  //   * счётчик прогресса 9 → 22 px. Это `showText={!isMobile}` в
  //     `QuestProgressSummary` (`questWizardShell.tsx`): без текста остаётся
  //     только полоса 3 px плюс отступ 6 px (`questWizardStyles/headerStyles.ts`,
  //     `progressBar`/`progressText`);
  //   * лента шагов 1 → 44 px. Ветка `screenW < 600` в `questWizardShell.tsx`
  //     рисует точки вместо пилюль. Оговорка: по стилям обе ветки заявляют 44 px
  //     (`questWizardStyles/stepsNavStyles.ts` — `stepDotTarget` 44x44 и
  //     `stepPill.minHeight` 44), так что 1 px — это транзиентный обмер самого
  //     нулевого кадра, а не разница объявленных высот. Замер прода
  //     (`layout-shift.sources`) фиксировал ровно `[.,.,.,1] → [.,.,.,44]`.
  // Суммарно на проде это давало CLS 0,40 на desktop-ширинах < 1280 (#1562) —
  // тот же класс, что #1282/#1298.
  //
  // Опция здесь безопасна: на web поддерево визарда монтируется только после
  // гидратации. В `app/(tabs)/quests/[city]/[questId].tsx` это `React.lazy` +
  // `Suspense` вокруг `QuestWizardComponent` и ранний return `LoadingState` по
  // `isLoading`, который на первом рендере всегда true — `useQuestBundle`
  // стартует с `loading: true`. В статическом HTML прода разметки визарда нет
  // (только «Загружаем квест…»), поэтому hydration mismatch (#418) невозможен.
  //
  // Отвергнутая альтернатива: зафиксировать ленте шагов и счётчику `minHeight`
  // под финальную геометрию. Не годится — высота ленты зависит от числа шагов и
  // длины названий, а горизонтальный padding контейнера всё равно переключается
  // 16 → 24 по тому же `isMobile`.
  const { width, height, isMobile } = useResponsive({ clientOnly: true })

  return useMemo<QuestWizardResponsiveModel>(() => {
    const isSmallScreen = width < 360
    const compactNav = width < 600
    const wideDesktop = width >= 1100
    const compactDesktopLayout = Platform.OS === 'web' && width >= 1280
    const useWideInlineLayout = wideDesktop
    const useWideExcursionsSidebar = wideDesktop && !compactDesktopLayout

    const sidebarWidth = width >= 1280 ? 340 : 300
    const mapPanelWidth = width >= 1280 ? 400 : 340
    const answerPaneWidth = Math.min(260, Math.max(200, width * 0.2))

    return {
      screenW: width,
      screenH: height,
      isMobile,
      isSmallScreen,
      compactNav,
      wideDesktop,
      compactDesktopLayout,
      useWideInlineLayout,
      useWideExcursionsSidebar,
      sidebarWidth,
      mapPanelWidth,
      answerPaneWidth,
    }
  }, [width, height, isMobile])
}
