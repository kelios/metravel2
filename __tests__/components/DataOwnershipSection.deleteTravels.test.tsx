// #1828: подпись разрушительной кнопки и сноска под ней — это то, что автор видит
// перед необратимым удалением своих путешествий. Набор держит отрисованный текст,
// а не только словарь: экран общий для web, Android и iOS.

import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockDeleteTravels = jest.fn();

jest.mock('@/hooks/useDataOwnership', () => ({
  useDataOwnership: () => ({
    exportData: jest.fn(),
    deleteMessages: jest.fn(),
    deleteTravels: mockDeleteTravels,
    revokeConsents: jest.fn(),
    lastExport: null,
    isExporting: false,
    isDeletingMessages: false,
    isDeletingTravels: false,
    isRevokingConsents: false,
  }),
}));

jest.mock('@expo/vector-icons/Feather', () => {
  const MockFeather = () => null;
  return { __esModule: true, default: MockFeather };
});

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  const MockButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{label}</Text>
    </Pressable>
  );
  return { __esModule: true, default: MockButton };
});

import DataOwnershipSection from '@/components/settings/DataOwnershipSection';
import { translate as i18nT } from '@/i18n';

describe('DataOwnershipSection destructive action copy (#1828)', () => {
  it('labels the action as deleting travels and never as deleting routes', () => {
    render(<DataOwnershipSection />);

    expect(
      screen.getByText(i18nT('profile:components.settings.DataOwnershipSection.deleteTravelsLabel')),
    ).toBeTruthy();
    expect(screen.queryByText('Удалить маршруты')).toBeNull();
  });

  it('renders the hint that separates the action from saved routes', () => {
    render(<DataOwnershipSection />);

    expect(
      screen.getByText(i18nT('profile:components.settings.DataOwnershipSection.deleteTravelsHint')),
    ).toBeTruthy();
  });
});
