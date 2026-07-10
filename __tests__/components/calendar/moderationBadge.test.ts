import { getModerationBadge } from '@/components/screens/calendar/calendarScreen.helpers'
import type { ThemedColors } from '@/hooks/useTheme'

const colors = {
  warning: '#f5a623',
  warningLight: '#fdf3e0',
  warningDark: '#8a5a00',
  info: '#2b7de9',
  infoLight: '#e3eefc',
  infoDark: '#124a8f',
} as unknown as ThemedColors

describe('getModerationBadge', () => {
  it('черновик → бейдж «Черновик» с warning-палитрой', () => {
    const badge = getModerationBadge('draft', colors)
    expect(badge).toEqual({
      label: 'Черновик',
      icon: 'edit-3',
      background: colors.warningLight,
      border: colors.warning,
      text: colors.warningDark,
    })
  })

  it('на модерации → бейдж «На модерации» с info-палитрой', () => {
    const badge = getModerationBadge('pending', colors)
    expect(badge).toEqual({
      label: 'На модерации',
      icon: 'clock',
      background: colors.infoLight,
      border: colors.info,
      text: colors.infoDark,
    })
  })

  it('опубликованное (undefined) → бейджа нет', () => {
    expect(getModerationBadge(undefined, colors)).toBeNull()
  })
})
