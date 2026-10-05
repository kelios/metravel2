import { formatDate } from '@/i18n/format';

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const DAY_WITH_YEAR: Intl.DateTimeFormatOptions = { ...DAY, year: 'numeric' };

const parse = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

// День без года понятен только внутри текущего года: «12 сент.» прошлогоднего
// диалога читается как недавний.
const formatDay = (date: Date, now: Date) =>
    formatDate(date, date.getFullYear() === now.getFullYear() ? DAY : DAY_WITH_YEAR);

/**
 * Метки времени личных сообщений (#2264). Язык — язык интерфейса (`i18n/format`),
 * а не браузера: `toLocaleDateString([])` показывал русскому интерфейсу «Sep 12»
 * в английском браузере.
 *
 * Строка диалога: сегодня — время, раньше — день (с годом вне текущего года).
 */
export const formatThreadTimestamp = (value: string | null | undefined, now: Date = new Date()): string => {
    const date = parse(value);
    if (!date) return '';
    return isSameDay(date, now) ? formatDate(date, TIME) : formatDay(date, now);
};

/** Сообщение в чате: сегодня — время, раньше — день и время. */
export const formatMessageTimestamp = (value: string | null | undefined, now: Date = new Date()): string => {
    const date = parse(value);
    if (!date) return '';
    const time = formatDate(date, TIME);
    return isSameDay(date, now) ? time : `${formatDay(date, now)}, ${time}`;
};
