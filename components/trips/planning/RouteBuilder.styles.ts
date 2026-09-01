import { Platform, StyleSheet } from 'react-native';
import type { ThemedColors } from '@/hooks/useTheme';
import { webStyle, webTextStyle, webViewStyle } from '@/utils/webProps';
export const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    errorText: { fontSize: 13, color: colors.danger, lineHeight: 18 },
    transportControl: {
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
    },
    // Вторичный ряд под сегментом транспорта: виден только для велосипеда.
    bikeTypeControl: { gap: 6 },
    bikeTypeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pointListScroll: Platform.select({
      web: webStyle({
        maxHeight: 'clamp(240px, calc(100dvh - 380px), 520px)' as unknown as number,
        overscrollBehaviorY: 'contain',
      }),
      default: { maxHeight: 520 },
    }),
    pointList: { gap: 8 },
    // Карточка точки: рамка и фон живут здесь, потому что под строкой в
    // мобильной раскладке раскрывается инлайн-редактор — он обязан оказаться
    // внутри той же карточки, а не отдельным блоком под ней.
    pointCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    pointCardEditing: { borderColor: colors.primary },
    pointRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 8,
      paddingRight: 12,
      paddingLeft: 4,
    },
    pointEditor: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    // Без ручки перетаскивания (чужой маршрут или единственная точка) строка
    // сохраняет прежние отступы — слева больше нечего компенсировать.
    pointRowFlat: { paddingVertical: 12, paddingLeft: 12 },
    // Строку под пальцем поднимаем над соседями: на Android порядок отрисовки
    // задаёт elevation, на web — zIndex.
    pointRowDragging: {
      zIndex: 2,
      elevation: 4,
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    pointRowDropTarget: { borderColor: colors.primary },
    // #1303: ручка перетаскивания. Таргет задаётся размером самой вью — hitSlop
    // на Android режет родитель. На web быстрый вертикальный смах остаётся
    // скроллом, а long-press забирает non-passive touchmove.
    dragHandle: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      ...Platform.select({
        web: webViewStyle({ cursor: 'grab', touchAction: 'pan-y', userSelect: 'none' }),
        default: {},
      }),
    },
    dragHandleActive: {
      backgroundColor: colors.surfaceMuted,
      ...Platform.select({ web: webViewStyle({ cursor: 'grabbing' }), default: {} }),
    },
    pointBody: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
    pointTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    // Номер точки: маркеры на карте одинаковые, и без номера строку списка не с
    // чем сопоставить.
    pointOrder: {
      minWidth: 18,
      height: 18,
      lineHeight: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      overflow: 'hidden',
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '700',
      color: colors.textOnPrimary,
      backgroundColor: colors.primary,
    },
    pointType: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    pointName: {
      minWidth: 0,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      ...Platform.select({
        web: webTextStyle({ wordBreak: 'normal', overflowWrap: 'break-word' }),
        default: {},
      }),
    },
    pointDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    descriptionLink: { color: colors.primaryDark, fontWeight: '700' },
    pointCoordinates: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    pointControls: { flexDirection: 'row', gap: 4 },
    ctrl: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    ctrlDisabled: { opacity: 0.4 },
    editForm: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    // Инлайн-редактор уже лежит внутри карточки точки: своя рамка и фон здесь
    // дали бы вторую рамку в рамке.
    editFormInline: {
      borderWidth: 0,
      borderRadius: 0,
      padding: 0,
      backgroundColor: 'transparent',
    },
    editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    // Опасное действие отделено от «Сохранить»/«Отмена»: удаление точки не
    // должно стоять вплотную к кнопке, которую жмут чаще всего.
    editDangerRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    typeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    typeChipText: { fontSize: 13, color: colors.text },
    typeChipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      ...Platform.select({ web: webTextStyle({ outlineWidth: 0 }) }),
    },
    // #1494: описание точки — многострочное поле. `textAlignVertical` нужен
    // Android: без него курсор multiline-поля центрируется по вертикали.
    textArea: {
      minHeight: 76,
      paddingTop: 10,
      textAlignVertical: 'top',
    },
    coordRow: { flexDirection: 'row', gap: 8 },
    coordInput: { flex: 1 },
    templates: { gap: 8 },
    templateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    templateBody: { flex: 1, gap: 2 },
    templateTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    templateDescription: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  });
