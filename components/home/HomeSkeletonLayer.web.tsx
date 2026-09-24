import type { useThemedColors } from '@/hooks/useTheme'

// Web: главная никогда не рисует слой скелетона — первый экран держит SSG-шелл
// (scripts/ssg-skeletons.js), а ветка `shouldShowSkeleton` в `app/(tabs)/index.tsx`
// на web недостижима. Пустой вариант убирает из веб-чанка главной разметку
// `HomePageSkeleton` и подсказку медленной загрузки (#2087); native — в
// `HomeSkeletonLayer.tsx`.
export function HomeSkeletonLayer(_props: { colors: ReturnType<typeof useThemedColors> }) {
  return null
}
