import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SUPPORTED_LOCALES} from '@/i18n/config';
import {buildQuestQrPrintModel, validateQuestQrOptions} from '../../scripts/quests/qr-kit-model';
import {classifyTrafficSource} from '@/utils/analyticsContext';
import krakow from '../fixtures/questQrPrintKit/krakow-dragon.json';
import minsk from '../fixtures/questQrPrintKit/minsk-cmok.json';
import provenance from '../fixtures/questQrPrintKit/provenance.json';

const options = {questId: 'krakow-dragon', cityId: 1, locale: 'ru' as const, campaign: 'park-start-01'};

describe('quest QR print kit from actual published responses', () => {
  it('keeps fixture provenance tied to the captured publication bytes', () => {
    for (const source of provenance.sources) {
      const bytes = fs.readFileSync(path.join(__dirname, '../fixtures/questQrPrintKit', `${source.questId}.json`));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
      expect(source.url).toMatch(/^https:\/\/metravel\.by\/api\/quests\/web\/detail\//);
    }
  });

  it.each(SUPPORTED_LOCALES)('prints source facts and %s labels without translating quest content', locale => {
    const models = [
      buildQuestQrPrintModel(krakow, {...options, locale}),
      buildQuestQrPrintModel(minsk, {...options, locale, questId: 'minsk-cmok', cityId: 4}),
    ];
    expect(models.map(model => ({questId: model.questId, locale: model.locale, contentLocale: model.contentLocale,
      text: model.text, facts: model.facts}))).toMatchSnapshot();
    expect(models[0].text.title).toBe(krakow.page.heading);
    expect(models[1].text.title).toBe(minsk.page.heading);
    expect(models[0].facts).toEqual({durationMin: 120, isFree: true});
    expect(models[1].facts).toEqual({durationMin: 45, isFree: true});
  });

  it('preserves canonical identity and placement in standard acquisition fields', () => {
    const model = buildQuestQrPrintModel(krakow, options);
    const url = new URL(model.targetUrl);
    expect(url.origin + url.pathname).toBe('https://metravel.by/quests/1/krakow-dragon');
    expect(Object.fromEntries(url.searchParams)).toEqual({utm_source: 'qr', utm_medium: 'referral', utm_campaign: 'park-start-01'});
    expect(classifyTrafficSource({utmSource: url.searchParams.get('utm_source')!})).toBe('campaign');
    expect(model.profiles).toEqual([
      {id: 'flyer-a5', widthMm: 148, heightMm: 210, qrMm: 70},
      {id: 'sticker-100x120', widthMm: 100, heightMm: 120, qrMm: 45},
    ]);
  });

  it.each(['', 'Venue Name', '../venue', 'x@y', 'a'.repeat(65)])('rejects unsafe or ambiguous placement %s', campaign => {
    expect(() => validateQuestQrOptions({...options, campaign})).toThrow('Campaign');
  });

  it('rejects unsupported locales and mismatched/unverified publication identity', () => {
    expect(() => validateQuestQrOptions({...options, locale: 'de'})).toThrow('locale');
    expect(() => buildQuestQrPrintModel(krakow, {...options, cityId: 4})).toThrow('matching published quest');
    expect(() => buildQuestQrPrintModel({...krakow, trip_facts: null}, options)).toThrow('verified trip facts');
    expect(() => buildQuestQrPrintModel({...krakow, locale: 'en'}, options)).toThrow('content locale');
  });

  it('does not accept an alias projection as the selected canonical city', () => {
    const aliased = {...krakow, requested_path: '/quests/4/krakow-dragon'};
    expect(() => buildQuestQrPrintModel(aliased, {...options, cityId: 4})).toThrow('matching published quest');
  });

  it('keeps unknown duration explicit and never labels a paid flag free', () => {
    const changed = {...krakow, trip_facts: {...krakow.trip_facts, duration_min: null, is_free: false}};
    const model = buildQuestQrPrintModel(changed, options);
    expect(model.text.duration).toBe('Время не указано');
    expect(model.text.offer).toBe('Без гида');
    expect(model.facts).toEqual({durationMin: null, isFree: false});
  });

  it('allows published noindex quests and preserves their source title', () => {
    const model = buildQuestQrPrintModel({...krakow, quality: {...krakow.quality, indexable: false}}, options);
    expect(model.text.title).toBe(krakow.page.heading);
  });
});
