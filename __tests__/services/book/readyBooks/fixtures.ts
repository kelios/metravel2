import {createHash} from 'node:crypto';
import type {BookArtifact, EditorialBookDraft, ReadyBook} from '../../../../types/readyBook';

export const fixturePdf = Buffer.from('%PDF-1.7\nIsolated integrity-test fixture; not a printable book.');
export const fixtureHash = createHash('sha256').update(fixturePdf).digest('hex');
const revision = '2026-10-27.1';

export function makeEditorialDraft(): EditorialBookDraft {
  return {
    schemaVersion: 1, status: 'editorial-draft', id: 'belarus-memory', slug: 'belarus',
    revision, country: 'BY', contentLocale: 'ru', title: 'Тестовое издание',
    stops: Array.from({length: 12}, (_, index) => ({
      id: `stop-${index}`, title: `Тестовое место ${index}`, localName: 'Тестовое имя',
      lat: 53.4, lng: 26.4, entrance: 'Ориентир тестового подхода',
      coordinateAccuracy: 'approach', coordinateSource: 'https://museum.example/location',
      source: {kind: 'official', id: `site-${index}`, url: 'https://museum.example/history'},
      text: {compact: 'Проверочный текст. '.repeat(24).trim(), album: 'Проверочный текст. '.repeat(32).trim()},
      fact: 'Изолированный пример, не редакционный факт.', observation: 'Сравните две формы.',
      references: [{url: 'https://museum.example/history', checkedAt: '2026-10-27', claims: ['Тестовые сведения']}],
      imageBrief: 'Изображение будет подготовлено отдельно.',
    })),
    miniTrips: [{id: 'sample-trip', title: 'Пример группы', stopIds: Array.from({length: 12}, (_, index) => `stop-${index}`), note: 'Не маршрут на один день.'}],
  };
}

export function makeReadyBook(): ReadyBook {
  const draft = makeEditorialDraft();
  const artifacts: BookArtifact[] = [];
  for (const profileId of ['pocket-150x100', 'album-a5'] as const) {
    const widthMm = profileId === 'album-a5' ? 148 : 150;
    const heightMm = profileId === 'album-a5' ? 210 : 100;
    const pairs: [BookArtifact['purpose'], BookArtifact['component']][] = [
      ['read', 'body'], ['read', 'cover'], ['home-rings', 'body'], ['home-rings', 'cover'],
      ['print-shop', 'body'], ['print-shop', 'cover'], ['stickers', 'stickers'],
      ['instructions', 'instructions'], ['print-passport', 'passport'],
      ...(profileId === 'album-a5' ? [['home-sewn', 'body'] as const] : []),
    ];
    for (const [purpose, component] of pairs) {
      const home = purpose.startsWith('home-');
      const shop = purpose === 'print-shop';
      const extra = ['stickers', 'instructions', 'print-passport'].includes(purpose);
      const bleedMm = shop ? 3 : 0;
      artifacts.push({
        id: `${profileId}-${purpose}-${component}`, revision, profileId, purpose, component,
        uri: `/books/${draft.id}/${revision}/${profileId}-${purpose}-${component}.pdf`,
        mime: 'application/pdf', sha256: fixtureHash, bytes: fixturePdf.length,
        pageCount: extra ? (purpose === 'stickers' ? 2 : 1) : home ? (component === 'body' ? 28 : 2) : component === 'body' ? 56 : 4,
        printProfile: {id: profileId, widthMm, heightMm, bleedMm, safeMm: 5, bindingMm: 15, binding: purpose === 'home-sewn' ? 'sewn' : 'rings'},
        outputPageMm: home ? (profileId === 'album-a5' ? {width: 297, height: 210} : {width: 210, height: 297}) : extra ? {width: 210, height: 297} : {width: widthMm + 2 * bleedMm, height: heightMm + 2 * bleedMm},
        imposition: purpose === 'home-sewn' ? 'a4-signatures' : home ? 'a4-cut' : 'single-pages',
        ...(purpose === 'home-sewn' ? {signatures: [16, 16, 16, 8]} : {}),
      });
    }
  }
  return {
    ...draft, status: 'ready', bodyPageCount: 56, coverPageCount: 4, artifacts,
    stops: draft.stops.map(stop => ({...stop, image: {
      uri: `/books/${draft.id}/${revision}/${stop.id}.png`, sha256: fixtureHash,
      credit: 'Test fixture', rights: 'Isolated test fixture', rightsBasis: 'owned',
      rightsSource: 'https://museum.example/rights', printAllowed: true, illustrated: true,
    }})),
    preview: artifacts.filter(file => file.purpose === 'read').map(file => ({
      revision, profileId: file.profileId, component: file.component as 'body' | 'cover', sourceSha256: file.sha256,
      pages: Array.from({length: file.pageCount}, (_, index) => ({
        number: index + 1, uri: `/books/${draft.id}/${revision}/${file.id}-${index + 1}.png`,
        sha256: fixtureHash, bytes: fixturePdf.length, alt: `${file.component} ${index + 1}`,
      })),
    })),
  };
}
