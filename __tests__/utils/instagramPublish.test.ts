import {
  buildFinalInstagramText,
  buildInstagramPublicationDraft,
  clampInstagramCaption,
  getInstagramAccountOptions,
  INSTAGRAM_CAPTION_MAX_LENGTH,
  stripHtmlToInstagramCaption,
  parseInstagramHashtags,
} from '@/utils/instagramPublish';
import type { TravelFormData } from '@/types/types';

const baseFormData: TravelFormData = {
  id: '12',
  slug: 'test-trip',
  name: 'Минск и Несвиж',
  countries: ['1'],
  cities: [],
  over_nights_stay: [],
  complexity: [],
  companions: [],
  description: '<p>Маршрут выходного дня по Беларуси с замками и прогулками.</p>',
  plus: null,
  minus: null,
  recommendation: null,
  youtube_link: null,
  gallery: [{ id: 1, url: 'https://example.com/gallery-1.jpg' }],
  categories: ['1'],
  countryIds: [],
  travelAddressIds: [],
  travelAddressCity: [],
  travelAddressCountry: [],
  travelAddressAdress: [],
  travelAddressCategory: [],
  coordsMeTravel: [
    { lat: 53.9, lng: 27.56, address: 'Минск' },
    { lat: 53.22, lng: 26.68, address: 'Несвижский замок' },
  ],
  thumbs200ForCollectionArr: [],
  travelImageThumbUrlArr: [],
  travelImageAddress: [],
  travel_image_thumb_small_url: 'https://example.com/cover.jpg',
  categoriesIds: [],
  transports: [],
  month: [],
  visa: false,
  publish: true,
  moderation: true,
};

describe('instagramPublish utils', () => {
  it('builds caption, hashtags and image list from travel data', () => {
    const draft = buildInstagramPublicationDraft({
      formData: baseFormData,
      countries: [{ country_id: '1', title_ru: 'Беларусь' }],
    });

    expect(draft.caption).toContain('Маршрут выходного дня');
    expect(draft.hashtags).toEqual(
      expect.arrayContaining(['#metravelby', '#беларусь', '#минск', '#несвижскийзамок'])
    );
    expect(draft.imageUrls).toEqual(['https://example.com/gallery-1.jpg']);
    expect(draft.finalText).toContain('#metravelby');
  });

  it('parses account options from json env payload', () => {
    expect(
      getInstagramAccountOptions(
        JSON.stringify([
          { key: 'metravelby', label: '@metravelby' },
          { key: 'alt', username: '@alt' },
        ])
      )
    ).toEqual([
      { key: 'metravelby', label: '@metravelby' },
      { key: 'alt', label: '@alt' },
    ]);
  });

  it('limits instagram gallery to first 10 photos', () => {
    const gallery = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      url: `https://example.com/gallery-${index + 1}.jpg`,
    }));

    const draft = buildInstagramPublicationDraft({
      formData: {
        ...baseFormData,
        gallery,
      },
      countries: [{ country_id: '1', title_ru: 'Беларусь' }],
    });

    expect(draft.imageUrls).toHaveLength(10);
    expect(draft.imageUrls[0]).toBe('https://example.com/gallery-1.jpg');
    expect(draft.imageUrls[9]).toBe('https://example.com/gallery-10.jpg');
  });

  it('drops junk address tags and keeps only human-readable poi tags', () => {
    const draft = buildInstagramPublicationDraft({
      formData: {
        ...baseFormData,
        coordsMeTravel: [
          { lat: 50.1, lng: 19.8, address: 'InPost 495 Cholerzyn' },
          { lat: 50.08, lng: 19.78, address: '274 Mników małopolskie' },
          { lat: 50.07, lng: 19.77, address: 'Jaskinia na Łopiankach II' },
          { lat: 50.06, lng: 19.76, address: 'Dolina Mnikowska, małopolskie' },
        ],
      },
      countries: [{ country_id: '1', title_ru: 'Польша' }],
    });

    expect(draft.hashtags).toEqual(
      expect.arrayContaining(['#metravelby', '#jaskiniałopiankach', '#dolinamnikowska', '#mników'])
    );
    expect(draft.hashtags).not.toEqual(expect.arrayContaining(['#inpostcholerzyn', '#mnikówmałopolskie']));
  });

  it('prioritizes route headline places from title and description', () => {
    const draft = buildInstagramPublicationDraft({
      formData: {
        ...baseFormData,
        name: 'Jaskinia na Łopiankach и Dolina Mnikowska',
        description: '<p>Недалеко от Кракова маршрут проходит через Dolina Mnikowska.</p>',
        coordsMeTravel: [{ lat: 50.1, lng: 19.8, address: 'InPost 495 Cholerzyn' }],
      },
      countries: [{ country_id: '1', title_ru: 'Польша' }],
    });

    expect(draft.hashtags).toEqual(
      expect.arrayContaining(['#metravelby', '#польша', '#jaskinianałopiankach', '#dolinamnikowska', '#кракова'])
    );
  });

  it('normalizes editable hashtags and keeps mandatory metravel tag', () => {
    expect(parseInstagramHashtags('#польша краков #Jaskinia-na-Łopiankach')).toEqual([
      '#metravelby',
      '#польша',
      '#краков',
      '#jaskinianałopiankach',
    ]);
    expect(buildFinalInstagramText('Test caption', ['#metravelby', '#польша'])).toBe(
      'Test caption\n\n#metravelby #польша'
    );
  });

  it('clamps generated caption to instagram limit and keeps final text publish-ready', () => {
    const longDescription = `<p>${'Очень длинное описание маршрута '.repeat(140)}</p>`;

    const draft = buildInstagramPublicationDraft({
      formData: {
        ...baseFormData,
        description: longDescription,
      },
      countries: [{ country_id: '1', title_ru: 'Беларусь' }],
    });

    expect(draft.finalText.length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_MAX_LENGTH);
    expect(draft.caption.length).toBeLessThan(stripHtmlToInstagramCaption(longDescription).length);
  });

  it('clamps manual caption to available length with hashtags', () => {
    const hashtags = ['#metravelby', '#польша', '#краков'];
    const caption = 'а'.repeat(2500);
    const result = clampInstagramCaption(caption, hashtags);

    expect(buildFinalInstagramText(result, hashtags).length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_MAX_LENGTH);
  });
});
