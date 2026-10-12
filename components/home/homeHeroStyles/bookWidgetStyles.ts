// components/home/homeHeroStyles/bookWidgetStyles.ts
import { Platform } from 'react-native'

import { HOME_HERO_MEDIA_SLOT_RATIO } from '../homeHeroShared'
import type { HeroStyleContext } from './context'

export const createBookWidgetStyles = (ctx: HeroStyleContext) => {
  const {
    colors,
    isMobile,
    viewportWidth,
    serif,
    sansSerif,
    editorialSerif,
    cardSurface,
    warmBorder,
    warmShadow,
    inkStrong,
    inkMuted,
  } = ctx

  return {
    tabletHeroRight: {
      width: viewportWidth >= 1000 ? '45%' : '42%',
      flexShrink: 0,
      // #1541: `heroRow` на планшете растягивает колонки (`alignItems:'stretch'`,
      // `minHeight:340`), а кадр теперь высотой в ширину/1.5. Без этого карточка
      // тянулась бы на высоту левой колонки, под фотографией висел бы пустой
      // блок, а подпись (`tabletFeaturedOverlay`, absolute bottom:0) отрывалась
      // бы от снимка.
      alignSelf: 'flex-start' as const,
      borderRadius: 20,
      overflow: 'hidden' as const,
      ...Platform.select({
        web: {
          boxShadow: `0 8px 32px ${warmShadow}, 0 2px 8px rgba(120,90,50,0.08)`,
        } as any,
      }),
    },
    tabletFeaturedImage: {
      // #1541: реальная ширина этой flex-колонки уже viewport из-за padding
      // и gap. Поэтому пропорция живёт здесь, на authoritative layout-боксе:
      // высота от оценки `viewport * 0.45` снова растянула бы слот и вернула
      // полосы.
      width: '100%',
      aspectRatio: HOME_HERO_MEDIA_SLOT_RATIO,
    },
    tabletFeaturedOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingVertical: 18,
      paddingTop: 48,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(12,10,8,0.92) 0%, rgba(12,10,8,0.55) 50%, rgba(12,10,8,0.15) 75%, transparent 100%)',
        } as any,
      }),
    },
    tabletFeaturedTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: colors.textOnDark,
      marginBottom: 4,
      letterSpacing: -0.3,
      ...Platform.select({
        web: {
          fontFamily: editorialSerif,
          textShadow: '0 2px 10px rgba(0,0,0,0.35)',
        } as any,
      }),
    },
    tabletFeaturedSubtitle: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.2,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },
    // Compact feature grid for tablet (2x2 grid)
    tabletFeatureGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 10,
      marginTop: 8,
    },
    tabletFeatureCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: cardSurface,
      borderWidth: 1,
      borderColor: warmBorder,
      width: viewportWidth >= 900 ? 'calc(50% - 5px)' : '100%',
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 4px rgba(120,96,62,0.06)',
          cursor: 'pointer',
        } as any,
      }),
    },
    tabletFeatureIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 6px ${colors.primary}20`,
        } as any,
      }),
    },
    tabletFeatureTextWrap: {
      flex: 1,
      gap: 2,
    },
    tabletFeatureTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: inkStrong,
      letterSpacing: -0.1,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    tabletFeatureSubtitle: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: inkMuted,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },

    bookPageNumber: {
      position: 'absolute' as const,
      bottom: ctx.pageNumberBottom,
      fontSize: isMobile ? 12 : 14,
      fontWeight: '500',
      letterSpacing: 0.5,
      color: 'rgba(140,110,60,0.35)',
      ...Platform.select({
        web: {
          fontFamily: serif,
          fontStyle: 'italic',
        } as any,
      }),
    },
    bookPageNumberLeft: { left: ctx.leftPageNumberLeft },
  } as const
}
