import React, { Suspense } from 'react';
import { Platform, Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import TravelWizardStepMedia from '@/components/travel/TravelWizardStepMedia';
import type { TravelFormData } from '@/src/types/types';

// Stub cover uploader
jest.mock('@/components/imageUpload/ImageUploadComponent', () => {
  const { Text } = require('react-native');
  return ({ collection, idTravel }: any) => (
    <Text testID="image-upload-stub">{`${collection}:${idTravel}`}</Text>
  );
});

// Stub gallery to avoid heavy dropzone and allow props inspection
jest.mock('@/components/travel/ImageGalleryComponent', () => {
  const { Text } = require('react-native');
  return ({ collection, idTravel, initialImages }: any) => (
    <Text testID="image-gallery-props">
      {JSON.stringify({ collection, idTravel, initialImages })}
    </Text>
  );
});

const baseFormData: TravelFormData = {
  id: '123',
  name: 'Test travel',
  countries: [],
  cities: [],
  over_nights_stay: [],
  complexity: [],
  companions: [],
  description: null,
  plus: null,
  minus: null,
  recommendation: null,
  youtube_link: null,
  gallery: [],
  categories: [],
  countryIds: [],
  travelAddressIds: [],
  travelAddressCity: [],
  travelAddressCountry: [],
  travelAddressAdress: [],
  travelAddressCategory: [],
  coordsMeTravel: [],
  thumbs200ForCollectionArr: [],
  travelImageThumbUrlArr: [],
  travelImageAddress: [],
  categoriesIds: [],
  transports: [],
  month: [],
  year: '2024',
  budget: '',
  number_peoples: '2',
  number_days: '3',
  visa: false,
  publish: false,
  moderation: false,
};

describe('TravelWizardStepMedia', () => {
  const originalPlatform = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
  });

  const renderStep = (formOverride: Partial<TravelFormData> = {}) =>
    render(
      <Suspense fallback={<Text testID="fallback">loading…</Text>}>
        <TravelWizardStepMedia
          currentStep={3}
          totalSteps={6}
          formData={{ ...baseFormData, ...formOverride }}
          setFormData={jest.fn()}
          travelDataOld={null}
          onManualSave={jest.fn()}
          onBack={jest.fn()}
          onNext={jest.fn()}
        />
      </Suspense>,
    );

  it('shows cover uploader when travel id exists', async () => {
    const { getByTestId } = renderStep({ id: '999' });

    await waitFor(() => expect(getByTestId('image-upload-stub')).toBeTruthy());
    expect(getByTestId('image-upload-stub').props.children).toBe('travelMainImage:999');
  });

  it('shows cover instruction when travel is not yet saved (no id)', async () => {
    const { getByText } = renderStep({ id: null });

    expect(
      getByText('Чтобы добавить обложку, сначала сохраните черновик (кнопка «Сохранить» внизу).'),
    ).toBeTruthy();
  });

  it('renders gallery with normalized images and correct collection', async () => {
    const gallery = [
      'https://example.com/legacy.jpg',
      { id: 7, url: '/relative/path.jpg' } as any,
    ];

    const { getByTestId } = renderStep({ id: '42', gallery });

    const galleryPropsNode = await waitFor(() => getByTestId('image-gallery-props'));
    const parsed = JSON.parse(galleryPropsNode.props.children);

    expect(parsed.collection).toBe('gallery');
    expect(parsed.idTravel).toBe('42');
    expect(parsed.initialImages).toHaveLength(2);
    expect(parsed.initialImages[0]).toEqual({ id: 'legacy-0', url: 'https://example.com/legacy.jpg' });
    expect(parsed.initialImages[1]).toEqual({ id: '7', url: '/relative/path.jpg' });
  });
});
