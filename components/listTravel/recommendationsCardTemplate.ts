import { Platform } from 'react-native'
import type { ViewStyle, ImageStyle, TextStyle } from 'react-native'

type TabCardTemplate = {
  container: ViewStyle
  imageContainer: ViewStyle
  image: ImageStyle
  content: ViewStyle
  title: TextStyle
  metaRow: ViewStyle
  metaText: TextStyle
}

const baseShadow: ViewStyle =
  Platform.select<ViewStyle>({
    web: {
      shadowColor: 'rgba(15, 23, 42, 0.18)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
  }) ?? {}

export const TAB_CARD_TEMPLATE: TabCardTemplate = {
  container: {
    width: 208,
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...baseShadow,
  },
  imageContainer: {
    height: 136,
    width: '100%',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2933',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
}

export const MOBILE_CARD_WIDTH = 172
