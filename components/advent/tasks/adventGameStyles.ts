import { StyleSheet } from 'react-native'

import type { AdventPaperPalette } from '@/constants/adventVisuals'
import { DESIGN_TOKENS } from '@/constants/designSystem'

/** Общие стили игр дверцы (#3487): карточки-«билетики» на тёплой бумаге листа. */
export const createAdventGameStyles = (paper: AdventPaperPalette) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    lead: { fontSize: 13, lineHeight: 19, color: paper.inkMuted },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    card: {
      minHeight: 44,
      flexGrow: 1,
      flexBasis: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: paper.edge,
      backgroundColor: paper.paper,
    },
    /** Кнопки игр не выходят за бумагу на 320 px (#3482): перенос и ширина не больше ряда. */
    button: { maxWidth: '100%' },
    columns: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.xs },
    column: { flex: 1, minWidth: 0, gap: DESIGN_TOKENS.spacing.xs },
    /** Карточка внутри колонки «пар»: без 45%-ной основы сетки. */
    cardInColumn: { flexBasis: 'auto', flexGrow: 0 },
    cardSelected: { borderColor: paper.gold, backgroundColor: paper.tag },
    cardDone: { borderColor: paper.success, opacity: 0.75 },
    cardText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19, color: paper.ink },
    meta: { fontSize: 12, fontWeight: '600', color: paper.inkMuted },
    soft: {
      gap: 2,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: paper.tag,
    },
    softText: { fontSize: 13, lineHeight: 19, color: paper.ink },
    softTitle: { fontSize: 13, fontWeight: '700', color: paper.gold },
  })
