import { memo, useCallback } from 'react'

import { translate as i18nT } from '@/i18n'
import type { AdventShareKind } from '@/utils/advent/adventShare'
import type { AdventCardSpec } from '@/utils/advent/adventShareImage'
import AdventShareActions from '../AdventShareActions'
import { useAdventCardShare } from '../useAdventCardShare'

/** Где кнопкам «Поделиться» взять год кампании и режим предпросмотра. */
export type AdventGameShareContext = { year: number; preview?: boolean }

type Props = AdventGameShareContext & {
  kind: Extract<AdventShareKind, 'title' | 'fortune'>
  /** Крупная строка карточки: звание или предсказание. */
  title: string
  subtitle: string
  titleRank?: number
  shareLabel: string
  shareText: string
  filename: string
  testIDPrefix: string
}

const TITLE_ART = ['departure', 'lanterns', 'trail', 'rail'] as const

/**
 * Шеринг итога игры (#3487): звание теста или рождественское предсказание —
 * звание получает иллюстрацию своего уровня независимо от языка.
 */
function AdventGameShare({ year, preview, kind, title, titleRank, subtitle, shareLabel, shareText, filename, testIDPrefix }: Props) {
  const buildSpec = useCallback(
    (): AdventCardSpec => ({
      eyebrow: i18nT('adventStatic:page.title'),
      title,
      subtitle,
      stats: [],
    }),
    [title, subtitle],
  )

  const { status, share, download, canDownload } = useAdventCardShare({
    kind,
    artwork: kind === 'title' ? TITLE_ART[Math.min(titleRank ?? 0, TITLE_ART.length - 1)] : undefined,
    preview,
    year,
    filename,
    buildSpec,
    shareTitle: title,
    shareText,
  })

  return (
    <AdventShareActions
      status={status}
      canDownload={canDownload}
      onShare={() => void share()}
      onDownload={() => void download()}
      shareLabel={shareLabel}
      testIDPrefix={testIDPrefix}
    />
  )
}

export default memo(AdventGameShare)
