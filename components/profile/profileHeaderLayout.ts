import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';

/**
 * Геометрия шапки профиля — один источник для своей шапки (`ProfileHeader`),
 * чужой (`PublicProfileHeader`) и скелета загрузки (`ProfileHeaderSection`).
 *
 * Узкий вариант (#2141) — экраны уже 360 (класс `isSmallPhone`: 320 web,
 * Android 320–359 dp). На 320×640 обычная геометрия вместе с отдельным рядом
 * быстрых действий занимала весь первый экран: обложка 132 + аватар 84 + ряд
 * действий 64. Узкая обложка ниже, аватар меньше, а быстрые действия идут
 * полосой у ВЕРХНЕЙ кромки обложки (слева от меню «⋮»), отдельного ряда нет.
 * Нулевой кадр до гидратации (`width === 0`) получает обычную геометрию.
 */
export type ProfileHeaderLayout = {
  narrow: boolean;
  coverHeight: number;
  avatarSize: number;
  avatarBorder: number;
  /** На сколько строка аватара заходит на обложку снизу: половина кольца. */
  avatarOverlap: number;
};

const AVATAR_BORDER = 3;

const buildLayout = (narrow: boolean, coverHeight: number, avatarSize: number): ProfileHeaderLayout => ({
  narrow,
  coverHeight,
  avatarSize,
  avatarBorder: AVATAR_BORDER,
  avatarOverlap: avatarSize / 2 + AVATAR_BORDER,
});

const REGULAR_LAYOUT = buildLayout(false, 132, 84);
const NARROW_LAYOUT = buildLayout(true, 88, 56);

/**
 * Полоса быстрых действий узкой шапки: от левой кромки обложки до меню «⋮»
 * (кнопка 44 с отступом `xs` от правой кромки). Аватар узкой шапки начинается
 * ниже полосы: 88 − 31 = 57 > 4 + 44 + 2·4 = 56.
 */
export const PROFILE_HEADER_NARROW_ACTIONS_BAND = {
  top: DESIGN_TOKENS.spacing.xxs,
  left: DESIGN_TOKENS.spacing.xxs,
  right: DESIGN_TOKENS.spacing.xs + DESIGN_TOKENS.touchTarget.minWidth + DESIGN_TOKENS.spacing.xxs,
} as const;

export function resolveProfileHeaderLayout(width: number): ProfileHeaderLayout {
  return width > 0 && width < METRICS.breakpoints.phone ? NARROW_LAYOUT : REGULAR_LAYOUT;
}
