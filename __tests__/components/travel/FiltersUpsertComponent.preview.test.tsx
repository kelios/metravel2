import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/components/forms/MultiSelectField', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/forms/CheckboxComponent', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/travel/PhotoUploadWithPreview', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native-paper', () => ({
  Button: ({ onPress, children }: any) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(Pressable, { onPress }, React.createElement(Text, null, children));
  },
}));

describe('FiltersUpsertComponent preview opening', () => {
  const formData: any = {
    id: null,
    slug: 'sample-travel',
    publish: false,
    countries: [],
    categories: [],
    transports: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    month: [],
    visa: false,
  };

  const filters: any = {
    categories: [],
    countries: [],
    transports: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    month: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens native preview via safe external helper', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'ios';

    const { getByText } = render(
      <FiltersUpsertComponent
        filters={filters}
        formData={formData}
        setFormData={jest.fn()}
        onSave={jest.fn()}
        showSaveButton={false}
        showPreviewButton
        showPublishControls={false}
        showCoverImage={false}
        showCountries={false}
        showCategories={false}
        showAdditionalFields={false}
      />
    );

    fireEvent.press(getByText('Предпросмотр'));

    expect(openExternalUrlInNewTab).toHaveBeenCalledWith(
      '/travels/sample-travel',
      expect.any(Object)
    );

    (Platform as any).OS = prevOs;
  });
});
