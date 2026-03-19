import { buildInstagramPublicationDraft, getInstagramAccountOptions } from '@/utils/instagramPublish';
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
    expect(draft.imageUrls).toEqual([
      'https://example.com/cover.jpg',
      'https://example.com/gallery-1.jpg',
    ]);
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
});
