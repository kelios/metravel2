import { METRICS } from '@/constants/layout';

type PhoneLayoutFlags = {
  width?: number;
  isPhone?: boolean;
  isLargePhone?: boolean;
};

/**
 * Телефонная раскладка: ширина ниже планшета, ВКЛЮЧАЯ маленькие телефоны
 * (< 360, класс `isSmallPhone` в `useResponsive`).
 *
 * Идиома `isPhone || isLargePhone` теряла класс < 360: на 320 web и Android
 * 320–359 dp компоненты рисовали desktop-вид (#2141: вкладки профиля по одной
 * в строку, 464 px). Нулевой кадр до гидратации (`width === 0`) остаётся «не
 * телефон», ровно как у прежней идиомы, — первый кадр статического HTML у
 * потребителей не меняется. `isMobile` из хука для этого не годится: он
 * истинен и при `width === 0`.
 *
 * Функция, а не поле хука: тесты мокают `useResponsive` объектом без нового
 * поля, а от тех же флагов предикат даёт в моках прежний ответ.
 */
export function isPhoneLayout({ width, isPhone, isLargePhone }: PhoneLayoutFlags): boolean {
  if (isPhone || isLargePhone) return true;
  return typeof width === 'number' && width > 0 && width < METRICS.breakpoints.phone;
}
