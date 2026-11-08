import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

export const createPointListStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<any>({
  wrapper: { width: '100%', marginTop: DESIGN_TOKENS.spacing.lg },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  statusHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryText,
  },
  toggle: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: DESIGN_TOKENS.spacing.md,
    minHeight: 48,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        cursor: 'pointer' as any,
      },
    }),
  },
  // Вид и при нажатии, и при наведении мыши (`hovered` у Pressable, #2036): ключ-псевдокласс
  // в StyleSheet react-native-web компилирует в битое правило.
  togglePressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  toggleText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  toggleTextSm: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    letterSpacing: 0,
  },
  previewContainer: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
  },
  previewBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryText,
  },
  previewTextWrap: {
    flex: 1,
    gap: 1,
  },
  previewAddress: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
  },
  previewCoord: {
    fontSize: 11,
    color: colors.textMuted,
  },
  previewMore: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    paddingTop: DESIGN_TOKENS.spacing.xs,
  },
  previewFooter: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    paddingTop: DESIGN_TOKENS.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  previewFooterLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  previewFooterText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
    color: colors.primaryText,
  },
  listContent: {
    paddingBottom: DESIGN_TOKENS.spacing.xxl,
    paddingHorizontal: Platform.select({
      web: 0,
      default: 8,
    }),
  },
  columnWrap: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        paddingHorizontal: 0,
        display: 'flex' as any,
        flexDirection: 'row' as any,
      },
    }),
  },
  horizontalScroll: {
    width: '100%',
    ...Platform.select({
      web: {
        overflowX: 'auto' as any,
        overflowY: 'hidden' as any,
        overscrollBehaviorX: 'contain' as any,
        WebkitOverflowScrolling: 'touch' as any,
        touchAction: 'pan-x pan-y' as any,
      },
    }),
  },
  webGridWrap: Platform.OS === 'web' ? {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' as any,
    gap: DESIGN_TOKENS.spacing.md,
    width: '100%' as any,
  } : {
    flexDirection: 'row' as any,
    flexWrap: 'wrap' as any,
    gap: DESIGN_TOKENS.spacing.md,
  },
  colWebGrid: {
    width: '100%' as any,
    minWidth: 0,
    marginBottom: 0, // grid gap handles spacing — override col.marginBottom
  },
  horizontalListContent: {
    flexDirection: 'row' as any,
    gap: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: 4,
    ...Platform.select({
      web: {
        minWidth: 'max-content' as any,
        alignItems: 'stretch' as any,
      },
    }),
  },
  col: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        display: 'flex' as any,
        flexDirection: 'column' as any,
        height: '100%',
      },
    }),
  },
  col2: {
    width: Platform.select({
      web: 'calc(50% - 10px)' as any,
      default: '48%',
    }),
  },
  col1: {
    width: '100%',
  },
  colHorizontal: {
    width: Platform.select({
      web: 'min(320px, calc(100vw - 40px))' as any,
      default: 320,
    }),
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    display: 'block',
    backgroundColor: colors.backgroundTertiary,
    ...Platform.select({
      web: {
        objectFit: 'contain' as any,
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      default: {
        resizeMode: 'contain' as any,
      },
    }),
  },
  addButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  addButtonDisabled: {
    opacity: 0.65,
  },
  viewModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.md,
    alignSelf: 'flex-end',
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
      },
    }),
  },
  // Наведение мыши — `hovered` у Pressable (#2036); активная кнопка перекрывает его своим видом.
  viewModeBtnHovered: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  viewModeBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  viewModeBtnText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '500',
    color: colors.textMuted,
  },
  viewModeBtnTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  verticalListWrap: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  listRow: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    // Наведение мыши на строку — правило `[data-point-list-row]` в `app/global.css`
    // (маркер ставит `PointListRow`): ключ-псевдокласс в StyleSheet react-native-web
    // компилирует в битое правило (#2036).
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      },
    }),
  },
  // Строка = медиа-объект (кадр + текст) и под ним ряд действий на всю ширину.
  // Раньше кадр и колонка текста стояли в `row/stretch`: кадр 96px тянулся на
  // высоту всех кнопок (~190px), `contain` давал пустые поля сверху и снизу, а
  // действия в узкой колонке ломались на три строки.
  listRowPressable: {
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.xs,
    padding: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  listRowMain: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  // Слот кадра фиксированной формы 4:3 (большинство снимков точек — альбомные),
  // а не колонка высотой в строку: `contain` и заливка `dominant_color` остаются
  // (docs/RULES.md, «Images must preserve original aspect ratio»), поля минимальны.
  listRowThumb: {
    width: '30%',
    maxWidth: 128,
    aspectRatio: 4 / 3,
    alignSelf: 'flex-start',
    flexShrink: 0,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
    overflow: 'hidden',
  },
  listRowThumbPlaceholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backgroundTertiary,
  },
  listRowInfo: {
    flex: 1,
    minWidth: 0,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    paddingRight: DESIGN_TOKENS.spacing.xs,
    gap: 4,
    justifyContent: 'center',
  },
  listRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  listRowBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listRowBulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryText,
  },
  listRowTitle: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  listRowCoordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
  },
  listRowCoordText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      default: undefined,
    }),
  },
  listRowCategory: {
    fontSize: 11,
    color: colors.textMuted,
  },
  /**
   * Тач-таргет чипа координат (#1734): сама пилюля ~18dp и ей нельзя расти,
   * поэтому кликабельна прозрачная рамка 44dp вокруг неё. Рамка вынесена в
   * отрицательные поля, строка списка не растёт; соседние кнопки действий идут
   * позже в дереве и на пересечении выигрывают они, а не чип.
   */
  listRowCoordTouchFrame: {
    alignSelf: 'flex-start',
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    marginVertical: -12,
    justifyContent: 'center',
  },
  // Все элементы ряда высотой 44, поэтому выравнивание по верху: раскрытое меню
  // «Навигации» растёт вниз внутри своей колонки, а кнопки слева не съезжают в
  // середину его высоты.
  listRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  /**
   * Тач-таргет иконок «копировать»/«поделиться» (#1734): рамка 44dp вокруг
   * видимого квадрата 36 (`listRowIconBtn`). По горизонтали поля отрицательные
   * на ширину зазора, чтобы рамки соседних кнопок не пересекались.
   */
  listRowIconTouchFrame: {
    width: DESIGN_TOKENS.touchTarget.minWidth,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    // По вертикали без отрицательных полей: ряд и так высотой 44 («Навигация»,
    // «Мои точки»), а при выравнивании по верху квадрат 36 иначе встаёт на 4px
    // выше соседей.
    marginHorizontal: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Растёт в остатке ряда, но не шире 440 — без пилюли на всю ширину десктопа;
  // 440 — чтобы в раскрытом меню по три в ряд влезали «Яндекс Карты» без «…».
  // На узкой карточке не помещается после кнопок и уходит на вторую строку целиком.
  listRowNavigationMenu: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    minWidth: 0,
    maxWidth: 440,
  },
  listRowIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.backgroundSecondary ?? colors.surface,
    // Наведение мыши — правило `[data-point-list-icon]` в `app/global.css` (#2036).
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease' as any,
      },
    }),
  },
  listRowAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // 44 — минимум тач-таргета. Измерено в браузере до правки: 25×95 px (#1733).
    // Гейт `scripts/guard-touch-targets.js` эту кнопку не видит и увидеть не
    // может: он сравнивает только ОБЪЯВЛЕННЫЕ числовые размеры, а высота здесь
    // набиралась паддингом, рамкой и шрифтом. Расширение INTERACTIVE_ELEMENTS
    // на `CardActionPressable` (#1734) это тоже не чинит — проверено прогоном.
    minHeight: 44,
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    // Пилюля — та же форма, что у «Навигации» рядом.
    borderRadius: DESIGN_TOKENS.radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease' as any,
      },
    }),
  },
  // Наведение мыши — `hovered` у `CardActionPressable` (#2036).
  listRowAddBtnHovered: {
    backgroundColor: colors.primarySoft,
  },
  listRowAddBtnText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.primaryText,
  },
  globalFocusStyle: globalFocusStyles.focusable,
});
