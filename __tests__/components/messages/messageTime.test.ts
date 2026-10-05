import { i18n } from '@/i18n';
import { formatMessageTimestamp, formatThreadTimestamp } from '@/components/messages/messageTime';

// #2264: дата строки диалога и сообщения шла через `toLocale*String([])` — язык
// браузера, а не интерфейса. Теперь — `i18n/format`.
describe('message timestamps follow the interface language', () => {
    const now = new Date(2026, 9, 5, 18, 0);
    const today = new Date(2026, 9, 5, 9, 5).toISOString();
    const thisYear = new Date(2026, 8, 12, 14, 30).toISOString();
    const lastYear = new Date(2025, 8, 12, 14, 30).toISOString();

    afterAll(async () => {
        await i18n.changeLanguage('ru');
    });

    it.each([
        ['ru', '12 сент.', '12 сент. 2025 г.'],
        ['be', '12 вер', '12 вер 2025'],
        ['uk', '12 вер.', '12 вер. 2025 р.'],
        ['pl', '12 wrz', '12 wrz 2025'],
        ['en', 'Sep 12', 'Sep 12, 2025'],
    ])('%s: a thread row shows the day, with the year outside the current one', async (locale, day, dayWithYear) => {
        await i18n.changeLanguage(locale);

        expect(formatThreadTimestamp(thisYear, now)).toBe(day);
        expect(formatThreadTimestamp(lastYear, now)).toBe(dayWithYear);
    });

    it('shows only the time for today, in the interface language', async () => {
        await i18n.changeLanguage('ru');
        expect(formatThreadTimestamp(today, now)).toBe('09:05');
        expect(formatMessageTimestamp(today, now)).toBe('09:05');

        await i18n.changeLanguage('en');
        expect(formatThreadTimestamp(today, now)).toMatch(/^09:05\s?AM$/);
    });

    it('a chat message older than today carries day and time', async () => {
        await i18n.changeLanguage('ru');
        expect(formatMessageTimestamp(thisYear, now)).toBe('12 сент., 14:30');
        expect(formatMessageTimestamp(lastYear, now)).toBe('12 сент. 2025 г., 14:30');
    });

    it.each([null, undefined, '', 'not-a-date'])('returns an empty label for %p', (value) => {
        expect(formatThreadTimestamp(value, now)).toBe('');
        expect(formatMessageTimestamp(value, now)).toBe('');
    });
});
