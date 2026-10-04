import { legalGenerated1 as be } from '@/i18n/locales/be/generated/legal_01';
import { legalGenerated1 as en } from '@/i18n/locales/en/generated/legal_01';
import { legalGenerated1 as pl } from '@/i18n/locales/pl/generated/legal_01';
import { legalGenerated1 as ru } from '@/i18n/locales/ru/generated/legal_01';
import { legalGenerated1 as uk } from '@/i18n/locales/uk/generated/legal_01';

// #2132 (Apple 1.2): «Пользовательское соглашение» и «Правила сообщества»,
// с которыми человек соглашается до входа, на каждой production-локали
// содержат нулевую терпимость и срок разбора жалоб 24 часа и не помечены
// как черновик на юр-проверке (#436).

const locales = { ru, be, uk, pl, en } as const;

const ZERO_TOLERANCE: Record<keyof typeof locales, RegExp> = {
  ru: /нулев\S* терпимост/i,
  be: /нулявой цярпімасц|нулявая цярпімасць/i,
  uk: /нульов\S* толерантн/i,
  pl: /zerow\S* tolerancj/i,
  en: /zero tolerance/i,
};

const DRAFT_MARKER = /юр-провер|на юр\.|предварительная редакция|under legal review|preliminary (version|edition)|weryfikacj\S* prawn|юр-правер|юр-перевір/i;

describe.each(Object.entries(locales))('legal %s', (locale, dict) => {
  const strings = dict as Record<string, string>;
  const zeroTolerance = ZERO_TOLERANCE[locale as keyof typeof locales];

  it('Условия: нулевая терпимость к недопустимому контенту и злоупотребляющим пользователям', () => {
    expect(strings['app.tabs.terms.zeroTolerance']).toMatch(zeroTolerance);
  });

  it('Условия и Правила: жалобы разбираются за 24 часа', () => {
    expect(strings['app.tabs.terms.contentComplaints']).toMatch(/24/);
    expect(strings['app.tabs.community_rules.reportingAndBlocking']).toMatch(/24/);
  });

  it('Правила сообщества: нулевая терпимость', () => {
    expect(strings['app.tabs.community_rules.zeroTolerance']).toMatch(zeroTolerance);
  });

  it('нет пометки о черновике на юр-проверке', () => {
    const marked = Object.entries(strings).filter(([, value]) => DRAFT_MARKER.test(value));
    expect(marked).toEqual([]);
  });
});
