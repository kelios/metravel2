import {
  buildTravelAssetSources,
  buildTravelOfflineSnapshot,
} from '@/services/offline/travelOfflineAdapter';
import {
  buildArticleAssetSources,
  buildArticleOfflineSnapshot,
} from '@/services/offline/articleOfflineAdapter';
import { buildQuestAssetSources } from '@/services/offline/questOfflineAdapter';
import type { ApiQuestBundle } from '@/api/quests';
import type { Article, Travel } from '@/types/types';

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
