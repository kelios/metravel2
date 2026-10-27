import React, { useMemo } from 'react'
import { Link, type Href } from 'expo-router'
import type { Travel } from '@/types/types'
import type { TravelLinkGraph } from '@/utils/travelLinkGraph'
import { adaptMeta } from '@/utils/questAdapters'
import { translate as i18nT } from '@/i18n'
import { QuestForCityMatches } from './QuestForCitySection'
import { QUEST_TILE_MEDIA_SIZE, QUEST_TILE_MEDIA_SIZE_COMPACT } from '@/components/quests/questCoverTileGeometry'

const RESPONSIVE_CARDS_CSS = `
[data-travel-link-graph] [data-quest-card-media]{width:${QUEST_TILE_MEDIA_SIZE}px!important;height:${QUEST_TILE_MEDIA_SIZE}px!important}
@media(max-width:767.98px){[data-travel-link-graph] [data-quest-card-arrow]{display:none!important}}
@media(max-width:479.98px){[data-travel-link-graph] [data-quest-card-media]{width:${QUEST_TILE_MEDIA_SIZE_COMPACT}px!important;height:${QUEST_TILE_MEDIA_SIZE_COMPACT}px!important}}
`

export default function TravelSelectedLinks({ travel, styles, graph }: { travel: Travel; styles: any; graph: TravelLinkGraph }) {
  const matches = useMemo(() => graph.quests.map((match) => ({
    quest: adaptMeta(match.quest), distanceKm: match.distance_km ?? Number.POSITIVE_INFINITY,
  })), [graph.quests])
  const heading = i18nT('travel:components.listTravel.parts.ListTravelTopContent.pohozhie_marshruty_f6f509b4')
  return <>
    <style>{RESPONSIVE_CARDS_CSS}</style>
    <QuestForCityMatches travel={travel} styles={styles} matches={matches} responsiveWeb />
    {graph.related.length ? <nav aria-label={heading} data-travel-related-links style={{ margin: '24px 0', color: 'var(--color-text)' }}>
      <h2 style={{ fontSize: 22, lineHeight: 1.3 }}>{heading}</h2>
      <ul style={{ paddingInlineStart: 22, lineHeight: 1.65 }}>
        {graph.related.map((link) => <li key={link.path}><Link href={link.path as Href} style={{ color: 'var(--color-primary)' }}>{link.name}</Link></li>)}
      </ul>
    </nav> : null}
  </>
}
