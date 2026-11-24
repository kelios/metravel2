import { memo, useCallback } from 'react'

import { ADVENT_MAIN_DOORS } from '@/constants/advent'
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
  shareLabel: string
  shareText: string
  filename: string
  testIDPrefix: string
}

/**
 * Шеринг итога игры (#3487): звание теста или рождественское предсказание —
 * та же карточка с ночным домом, что у открытки 25.12 и итогов года.
 */
function AdventGameShare({ year, preview, kind, title, subtitle, shareLabel, shareText, filename, testIDPrefix }: Props) {
  const buildSpec = useCallback(
    (): AdventCardSpec => ({
      eyebrow: i18nT('adventStatic:page.title'),
      title,
      subtitle,
      stats: [],
      house: { lit: ADVENT_MAIN_DOORS },
    }),
    [title, subtitle],
  )

  const { status, share, download, canDownload } = useAdventCardShare({
    kind,
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
