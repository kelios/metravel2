import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, ScrollView } from 'react-native';
import FiltersUpsertComponent from '@/components/travel/FiltersUpsertComponent';

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

// Компонент всегда встроен в скроллящийся шаг мастера (TravelWizardStepExtras).
// Собственный вертикальный ScrollView перехватывал жест родителя на Android и
// делал недостижимыми поля ниже категорий: год, точную дату, участников,
// длительность и бюджет.
describe('FiltersUpsertComponent scroll ownership', () => {
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

  const renderExtras = () =>
    render(
      <FiltersUpsertComponent
        filters={filters}
        formData={formData}
        setFormData={jest.fn()}
        onSave={jest.fn()}
        showSaveButton={false}
        showPreviewButton={false}
        showPublishControls={false}
        showCoverImage={false}
        showCountries={false}
        showCategories={false}
        showAdditionalFields
      />
    );

  it('does not nest its own vertical ScrollView inside the wizard step', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'android';

    const { UNSAFE_queryAllByType } = renderExtras();
    expect(UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);

    (Platform as any).OS = prevOs;
  });

  it('keeps the exact visited-date field reachable in the additional fields group', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'android';

    const { getByText } = renderExtras();
    expect(getByText('Дата, когда был(а)')).toBeTruthy();

    (Platform as any).OS = prevOs;
  });
});
