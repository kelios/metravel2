import { ADVENT_PAPER_COLORS, type AdventPaperPalette } from '@/constants/adventVisuals'
import { useTheme } from '@/hooks/useTheme'

/** Тёплая «бумага» листа дверцы по теме интерфейса (#3482). Лист рисуется после тапа — без SSR-расхождения. */
export function useAdventPaper(): AdventPaperPalette {
  const { isDark } = useTheme()
  return isDark ? ADVENT_PAPER_COLORS.dark : ADVENT_PAPER_COLORS.light
}
