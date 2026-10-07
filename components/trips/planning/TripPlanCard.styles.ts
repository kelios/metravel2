import { StyleSheet } from 'react-native';
import type { ThemedColors } from '@/hooks/useTheme';

export const TRIP_PLAN_CARD_MEDIA_HEIGHT = 176;

export const createTripPlanCardStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 14,
    },
    cardDeleting: { opacity: 0.6 },
    contentContainer: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
    contentStack: { gap: 6 },
    headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: colors.textOnDark },
    visibilityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
    },
    visibilityText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    // #1344: two independently measured dynamic Text siblings clipped at every
    // intrinsic/flex allocation tried on Pixel. One flexible string gives Yoga
    // a single remaining-width outlet and preserves normal wrapping.
    meta: { fontSize: 13, color: colors.textSecondary, flex: 1 },
    route: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    footer: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    occupancyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
    footerText: { fontSize: 13, fontWeight: '700', color: colors.text },
    // #1342: `Text` в row Yoga на Android меряет по intrinsic-ширине и обрезает
    // системным ellipsis, а не переносит («· 1 в списке» → «· 1 в»). Нужен именно
    // `flex: 1`: одного `flexShrink` мало — при `flexBasis: 'auto'` Android успевает
    // сверстать текст в одну строку до сжатия бокса. `flexBasis: 0` из `flex: 1`
    // заставляет мерить сразу по доступной ширине, и текст переносится.
    participantsHint: { fontSize: 12, color: colors.textMuted, flex: 1 },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    manageButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
    },
    manageButtonPressed: { opacity: 0.86 },
    // #1660: второй владельческий значок забрал у строки ещё 52dp, и самая
    // длинная локализованная подпись («Zarządzaj swoją podróżą») перестала
    // помещаться в 100%-карточку на телефоне. Без `flexShrink` Yoga отдаёт
    // тексту интринсик-ширину и он вылезает за кнопку, поэтому сжимаем подпись
    // и обрезаем её многоточием вместо переполнения ряда.
    manageButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textOnPrimary,
      flexShrink: 1,
    },
    // #1660: «...» + нижний лист заменены явными иконками в той же строке —
    // два владельческих действия не окупают скрытое меню и читаются сразу.
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    iconButtonDanger: { borderColor: colors.dangerLight, backgroundColor: colors.dangerSoft },
    iconButtonPressed: { opacity: 0.72 },
    mediaPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surfaceMuted,
    },
  });
