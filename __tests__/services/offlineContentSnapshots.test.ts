import {
  buildTravelAssetSources,
  buildTravelOfflineSnapshot,
  readTravelOffline,
  saveTravelOffline,
} from '@/services/offline/travelOfflineAdapter';
import {
  buildArticleAssetSources,
  buildArticleOfflineSnapshot,
  readArticleOffline,
  saveArticleOffline,
} from '@/services/offline/articleOfflineAdapter';
import { buildQuestAssetSources } from '@/services/offline/questOfflineAdapter';
import type { ApiQuestBundle } from '@/api/quests';
import type { Article, Travel } from '@/types/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineCatalog } from '@/services/offline/offlineCatalog';
import packageStore from '@/services/offline/packageStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Exercise real JSON persistence without the native filesystem test stub.
jest.mock('@/services/offline/packageStore', () =>
  jest.requireActual('@/services/offline/packageStore.ts'),
);

const travelFixture = {
  id: 42,
  slug: 'public-route',
  name: 'Public route',
  travel_image_thumb_url: 'https://metravel.by/cover.jpg',
  travel_image_thumb_small_url: 'https://metravel.by/cover-small.jpg',
  url: '/travels/public-route',
  youtube_link: '',
  userName: 'Author',
  description: '<p>Safe</p><script>bad()</script>',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: 'Minsk',
  countryName: 'Belarus',
  countUnicIpView: '10',
  gallery: ['https://metravel.by/full-gallery.jpg'],
  travelAddress: [{
    id: 7,
    address: 'Point',
    coord: '53.9,27.56',
    categoryName: 'Museum',
    travelImageThumbUrl: 'https://metravel.by/point.jpg',
    private_note: 'must not persist',
  }],
  userIds: '1',
  year: '2026',
  monthName: 'July',
  number_days: 1,
  companions: [],
  countryCode: 'BY',
  token: 'must not persist',
} as unknown as Travel;

const articleFixture = {
  id: 8,
  slug: 'public-article',
  name: 'Public article',
  description: '<p>Article</p><script>bad()</script>',
  article_image_thumb_url: 'https://metravel.by/article.jpg',
  article_image_thumb_small_url: 'https://metravel.by/article-small.jpg',
  article_type: {
    id: 1,
    name: 'Guide',
    status: 1,
    created_at: 0,
    updated_at: 0,
  },
  password: 'must not persist',
  internal_draft: 'must not persist',
} as unknown as Article;

describe('typed public offline content snapshots', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe.each([
    {
      type: 'travel' as const,
      fixture: { ...travelFixture, rating: 4.2, rating_count: 12, comment_count: 3, comments_count: 3 },
      build: (value: Travel | Article) => buildTravelOfflineSnapshot(value as Travel),
      save: (value: Travel | Article) => saveTravelOffline(value as Travel),
      read: readTravelOffline,
      route: '/travels/public-route',
    },
    {
      type: 'article' as const,
      fixture: { ...articleFixture, rating: 4.2, rating_count: 12 },
      build: (value: Travel | Article) => buildArticleOfflineSnapshot(value as Article),
      save: (value: Travel | Article) => saveArticleOffline(value as Article),
      read: readArticleOffline,
      route: '/article/public-article',
    },
  ])('$type personal rating isolation', ({ type, fixture, build, save, read, route }) => {
    it('excludes account A rating on write and keeps the online response unchanged', async () => {
      const online = Object.freeze({ ...fixture, user_rating: 5 });
      const publicSnapshot = build(online);
      expect(publicSnapshot).not.toHaveProperty('user_rating');
      expect(publicSnapshot).toMatchObject({ rating: 4.2, rating_count: 12 });
      if (type === 'travel') {
        expect(publicSnapshot).toMatchObject({ comment_count: 3, comments_count: 3 });
      }

      const manifest = await save(online);
      expect(manifest).toMatchObject({ authScope: 'public', status: 'ready' });
      const stored = await packageStore.read(manifest!.key);
      expect(stored!.snapshot).not.toHaveProperty('user_rating');
      // Adapters have no identity argument: guest and account B use this same read.
      for (const identifier of [fixture.id!, fixture.slug!]) {
        expect(await read(identifier)).toEqual(publicSnapshot);
      }
      expect(online.user_rating).toBe(5);
    });

    it.each([5, 0, null])('strips legacy user_rating=%s for id and slug reads without losing public data', async (userRating) => {
      const publicSnapshot = build(fixture);
      const legacy = { ...publicSnapshot, user_rating: userRating };
      const manifest = await offlineCatalog.save({
        key: `${type}:${fixture.id}`,
        type,
        sourceId: fixture.id!,
        authScope: 'public',
        route,
        title: fixture.name,
        snapshot: legacy,
      });
      for (const identifier of [fixture.id!, fixture.slug!]) {
        const result = await read(identifier);
        expect(result).not.toHaveProperty('user_rating');
        expect(result).toEqual(publicSnapshot);
      }
      // Sanitizing a read must not mutate objects held by other callers.
      expect(legacy.user_rating).toBe(userRating);
      expect((await packageStore.read(manifest.key))!.snapshot).toEqual(legacy);
    });

    it('returns null for an absent or missing package', async () => {
      await expect(read(fixture.slug!)).resolves.toBeNull();
      const manifest = await save(fixture);
      await packageStore.remove(manifest!.key);
      await expect(read(fixture.id!)).resolves.toBeNull();
    });
  });

  it('constructs a sanitized travel snapshot without gallery/private extras', () => {
    const snapshot = buildTravelOfflineSnapshot(travelFixture);

    expect(snapshot.descriptionHtml).toContain('<p>Safe</p>');
    expect(snapshot.descriptionHtml).not.toContain('<script');
    expect(snapshot.gallery).toEqual([]);
    expect(snapshot.routePoints).toEqual([expect.objectContaining({
      id: '7',
      lat: 53.9,
      lng: 27.56,
      imageUrl: 'https://metravel.by/point.jpg',
    })]);
    expect(JSON.stringify(snapshot)).not.toContain('must not persist');
    expect(buildTravelAssetSources(snapshot).map((item) => item.id)).toEqual([
      'https://metravel.by/cover.jpg',
      'https://metravel.by/point.jpg',
    ]);
  });

  it('constructs a sanitized article snapshot from an explicit public allowlist', () => {
    const snapshot = buildArticleOfflineSnapshot(articleFixture);

    expect(snapshot.safeHtml).toContain('<p>Article</p>');
    expect(snapshot.safeHtml).not.toContain('<script');
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      id: 8,
      slug: 'public-article',
      name: 'Public article',
    });
    expect(JSON.stringify(snapshot)).not.toContain('must not persist');
    expect(buildArticleAssetSources(snapshot).map((item) => item.id)).toEqual([
      'https://metravel.by/article.jpg',
    ]);
  });

  it('keeps an inline article image downloadable when no separate cover exists', () => {
    const inlineOnlyArticle = {
      id: 9,
      slug: 'inline-only',
      name: 'Inline only',
      description: '',
      rich_text: {
        description: {
          safe_html: '<p>Body</p><img src="https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/photo.JPG">',
        },
      },
      article_image_thumb_url: null,
      article_image_thumb_small_url: null,
    } as unknown as Article;

    const snapshot = buildArticleOfflineSnapshot(inlineOnlyArticle);
    const assets = buildArticleAssetSources(snapshot);

    expect(assets).toHaveLength(1);
    expect(assets[0].id).toContain('photo.JPG');
    expect(assets[0].url).toContain('photo.JPG');
  });

  it('selects every quest-owned cover, intro, step and finale image only', () => {
    const bundle = {
      quest_id: 'quest',
      title: 'Quest',
      cover_url: 'https://metravel.by/quest-cover.jpg',
      intro: JSON.stringify({ image_url: 'https://metravel.by/intro.jpg' }),
      steps: JSON.stringify([
        { image_url: 'https://metravel.by/step-1.jpg' },
        { image_url: 'https://metravel.by/step-2.jpg' },
      ]),
      finale: { poster_url: 'https://metravel.by/finale.jpg' },
      first_completer: { avatar: 'https://metravel.by/avatar.jpg' },
    } as unknown as ApiQuestBundle;

    expect(buildQuestAssetSources(bundle).map((item) => item.id)).toEqual([
      'https://metravel.by/quest-cover.jpg',
      'https://metravel.by/intro.jpg',
      'https://metravel.by/step-1.jpg',
      'https://metravel.by/step-2.jpg',
      'https://metravel.by/finale.jpg',
    ]);
  });
});
