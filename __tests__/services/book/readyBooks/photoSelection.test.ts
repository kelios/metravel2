import byEvidence from '@/data/travelBooks/by/photo-evidence.json';
import plEvidence from '@/data/travelBooks/pl/photo-evidence.json';
import mountainSources from '@/data/travelBooks/series/mountains-pl-sources.json';
import castleSources from '@/data/travelBooks/series/castles-pl-sources.json';
import castleCopy from '@/data/travelBooks/series/castles-pl-copy.json';
import {readyBookStyles} from '@/services/book/readyBooks/render/styles';
import {bookStyleCopy} from '@/services/book/readyBooks/render/styleCopy';
import type {PrintProfile} from '@/types/readyBook';

// #2968: a reader's book prints one clean photograph per place — never a blend of
// near-identical frames and never a person (the author included).
describe('photographic editions print one people-free frame per place', () => {
  it.each([['BY', byEvidence], ['PL', plEvidence]] as const)('%s photo evidence', (_country, evidence: any) => {
    for (const place of evidence.places) {
      const used = place.photos.filter((photo: any) => photo.status === 'used');
      expect([place.stopId, used.length]).toEqual([place.stopId, 1]);
      expect(used[0]).toMatchObject({role: 'main', peopleFree: true});
      for (const photo of place.photos.filter((item: any) => item.status !== 'used')) {
        expect(photo.status).toBe('not-printed');
        expect(['people', 'duplicate', 'weak', 'low-res']).toContain(photo.notPrintedReason);
      }
    }
    expect(evidence.cover.photo).toMatchObject({role: 'cover', peopleFree: true});
    expect(evidence.places.map((place: any) => place.stopId)).toContain(evidence.cover.stopId);
  });

  it('keeps the owner cover decision: Несвиж, not Мир, on the Belarus photo cover', () => {
    expect(byEvidence.cover.stopId).toBe('point-5246');
    expect(byEvidence.cover.photo.originalUri).toContain('S3H0kLrM2diTfxeSy07XbhWCyeb4DP9DxsAsslMW');
  });

  it.each([['mountains-pl', mountainSources], ['castles-pl', castleSources]] as const)('%s prints only people-free photographs', (_series, sources: any) => {
    for (const place of sources.places) {
      const media = place.thematic.media;
      expect([place.id, media.peopleFree]).toEqual([place.id, true]);
      if (media.crop) {
        expect(media.crop.leftPx + media.crop.widthPx).toBeLessThanOrEqual(media.widthPx);
        expect(media.crop.topPx + media.crop.heightPx).toBeLessThanOrEqual(media.heightPx);
      }
      expect(media.caption).not.toMatch(/на (фото|снимке)|кадр|не показан|не иллюстрируется|не подтвержд/i);
    }
  });

  it('retouches exactly the owner-approved frames and pins each derivative by SHA', () => {
    const retouched = [
      ...[...byEvidence.places, ...plEvidence.places].flatMap((place: any) => place.photos.filter((photo: any) => photo.retouch).map((photo: any) => ({id: place.stopId, photo, record: photo.retouch}))),
      ...[...mountainSources.places, ...castleSources.places].filter((place: any) => place.thematic.media.retouch).map((place: any) => ({id: place.id, photo: place.thematic.media, record: place.thematic.media.retouch})),
    ];
    expect(retouched.map(item => item.id).sort()).toEqual(['castles-pl-30', 'mountains-pl-33', 'point-3011', 'point-5247']);
    for (const {photo, record} of retouched) {
      expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect([record.widthPx, record.heightPx]).toEqual([photo.widthPx, photo.heightPx]);
      expect(record.decision).toContain('убираем прохожих');
      if ('status' in photo) expect(photo.status).toBe('used');
    }
  });

  it('only the photographic imprint can admit a retouch', () => {
    expect(bookStyleCopy('photo').creditsRetouched).toContain('Отдельные снимки отретушированы: убраны случайные прохожие.');
    expect(bookStyleCopy('photo').creditsSource).toContain('без изменения содержания');
    for (const style of ['watercolor', 'graphic', 'fantasy'] as const) expect(bookStyleCopy(style).creditsRetouched).toBeUndefined();
  });

  it('memory prompts never describe a photo the book no longer prints', () => {
    expect(JSON.stringify(castleCopy)).not.toContain('зимнего снимка');
  });

  it('photographs keep crisp edges while drawn styles keep their paper fade', () => {
    const fonts = {regular: 'data:font/ttf;base64,AA==', bold: 'data:font/ttf;base64,AA==', serif: 'data:font/ttf;base64,AA=='};
    const profiles: PrintProfile[] = [
      {id: 'pocket-150x100', widthMm: 150, heightMm: 100, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'},
      {id: 'album-a5', widthMm: 148, heightMm: 210, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'},
    ];
    for (const profile of profiles) {
      expect(readyBookStyles(profile, fonts, 'photo')).toContain('.art-crop::after,.cover-illustration::after{content:none}');
      for (const style of ['watercolor', 'graphic', 'fantasy'] as const) {
        expect(readyBookStyles(profile, fonts, style)).not.toContain('{content:none}');
      }
    }
  });
});
