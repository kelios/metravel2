import { Platform } from 'react-native'
import type { ViewStyle, ImageStyle, TextStyle } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

type TabCardTemplate = {
  container: ViewStyle
  imageContainer: ViewStyle
  image: ImageStyle
  content: ViewStyle
  title: TextStyle
  metaRow: ViewStyle
  metaText: TextStyle
}

const getBaseShadow = (colors: ThemedColors): ViewStyle =>
  Platform.select<ViewStyle>({
    web: {
      boxShadow: (colors.boxShadows as any)?.card ?? DESIGN_TOKENS.shadows.card,
    },
    default: (colors.shadows as any)?.light ?? DESIGN_TOKENS.shadowsNative.light,
  }) ?? {}

export const createTabCardTemplate = (colors: ThemedColors): TabCardTemplate => ({
  container: {
    width: 208,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...getBaseShadow(colors),
  },
  imageContainer: {
    height: 136,
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
})

export const MOBILE_CARD_WIDTH = 172
