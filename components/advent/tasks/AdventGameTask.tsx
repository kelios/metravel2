import { memo } from 'react'

import type { AdventGame } from '@/types/advent'
import AdventFortuneTask from './AdventFortuneTask'
import type { AdventGameShareContext } from './AdventGameShare'
import AdventMatchTask from './AdventMatchTask'
import AdventPickTask from './AdventPickTask'
import AdventSelfcheckTask from './AdventSelfcheckTask'
import AdventWishlistTask from './AdventWishlistTask'

type Props = {
  game: AdventGame
  xp?: number
  onComplete: () => void
  onOpenLink: (link: string) => void
  /** Год кампании, день дверцы и предпросмотр: зерно гадания и шеринг итога. */
  day: number
  share: AdventGameShareContext
}

/**
 * Единая точка входа игр дверцы (#3487): лист не знает видов игр, он отдаёт
 * `task.game` сюда. Неизвестный вид (новее клиента) — `null`, и лист ведёт
 * задание по `task.type`, как старые сборки.
 */
function AdventGameTask({ game, xp, onComplete, onOpenLink, day, share }: Props) {
  switch (game.kind) {
    case 'selfcheck':
      return <AdventSelfcheckTask game={game} xp={xp} onComplete={onComplete} onOpenLink={onOpenLink} share={share} />
    case 'match':
      return <AdventMatchTask game={game} xp={xp} onComplete={onComplete} />
    case 'pick':
      return <AdventPickTask game={game} xp={xp} onComplete={onComplete} />
    case 'fortune':
      return <AdventFortuneTask game={game} seed={`${share.year}:${day}`} xp={xp} onComplete={onComplete} share={share} />
    case 'wishlist':
      return <AdventWishlistTask game={game} onOpenLink={onOpenLink} />
    default:
      return null
  }
}

export default memo(AdventGameTask)
