import React, { useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import TravelNoteFlow from '@/components/travel/note/TravelNoteFlow';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import type { TravelFormData } from '@/types/types';
import { getEmptyFormData } from '@/utils/travelFormUtils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/components/travel/TravelWizardHeader', () => {
  const { Pressable, Text } = require('react-native');
  return ({ title, onPrimary, primaryTestID }: any) => (
    <Pressable testID={primaryTestID} onPress={onPrimary}><Text>{title}</Text></Pressable>
  );
});

jest.mock('@/components/travel/upsert/WizardStepFooter', () => () => null);

jest.mock('@/components/travel/GallerySection', () => {
  const { Pressable, Text } = require('react-native');
  return ({ travelId, resolveTravelId, onChange }: any) => (
    <Pressable
      testID="gallery-stub"
      onPress={async () => {
        await resolveTravelId?.();
        onChange?.([{ id: 9, url: 'https://metravel.by/gallery/9.jpg' }]);
      }}
    >
      <Text>{`gallery:${travelId ?? ''}`}</Text>
    </Pressable>
  );
});

const POLAND = { lat: '50.06', lon: '19.94', place_id: '1', display_name: 'Rynek, Kraków, Polska', name: 'Rynek',
  address: { country: 'Polska', country_code: 'pl', city: 'Kraków' } };
const NOWHERE = { lat: '0', lon: '0', place_id: '2', display_name: 'Ocean', address: {} };

jest.mock('@/components/travel/LocationSearchInput', () => {
  const { Pressable, Text, View } = require('react-native');
  return ({ onLocationSelect }: any) => (
    <View>
      <Pressable testID="pick-poland" onPress={() => onLocationSelect(POLAND)}><Text>pl</Text></Pressable>
      <Pressable testID="pick-nowhere" onPress={() => onLocationSelect(NOWHERE)}><Text>none</Text></Pressable>
    </View>
  );
});

const STORY = 'Заехали сюда по дороге домой и остались до заката у старой мельницы.';

type Harness = { handleManualSave: jest.Mock; clearPersistedStep: jest.Mock };

let externalSetFormData: ((data: TravelFormData) => void) | null = null;

function renderNote(harness: Harness, initialStep = 1) {
  const Wrapper = () => {
    const [formData, setFormData] = useState<TravelFormData>({ ...getEmptyFormData(null), publication_format: 'note' });
    externalSetFormData = setFormData;
    const [step, setStep] = useState(initialStep);
    const controller = {
      colors: new Proxy({}, { get: () => '#000' }),
      formData,
      setFormData,
      setMarkers: jest.fn(),
      handleManualSave: async (...args: unknown[]) => {
        const saved = await harness.handleManualSave(...args);
        if (saved?.id) setFormData((prev) => ({ ...prev, id: String(saved.id) }));
        return saved;
      },
      filters: { countries: [{ country_id: 160, title_ru: 'Польша', code: 'PL' }] },
      wizard: {
        currentStep: step,
        handleNext: () => setStep(2),
        handleBack: () => setStep(1),
        handleExit: jest.fn(),
        handleStepSelect: setStep,
        clearPersistedStep: harness.clearPersistedStep,
      },
      autosaveBadge: '',
      isManualSaveInFlight: false,
    } as unknown as UpsertTravelController;
    return <TravelNoteFlow controller={controller} />;
  };
  return render(<Wrapper />);
}

describe('TravelNoteFlow (#2666)', () => {
  const harness: Harness = { handleManualSave: jest.fn(), clearPersistedStep: jest.fn(async () => undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    harness.handleManualSave.mockImplementation(async (_data?: TravelFormData, options?: { intent?: string }) => (
      options?.intent === 'submit' ? { id: 41, publication_status: 'pending_review' } : { id: 41 }
    ));
  });

  it('creates the note draft on the first photo and sends it after two screens', async () => {
    const screen = renderNote(harness);
    expect(screen.getByText('gallery:')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByTestId('gallery-stub')); });
    expect(harness.handleManualSave).toHaveBeenCalledWith({ publication_format: 'note' });

    fireEvent.press(screen.getByTestId('travel-note.next'));
    fireEvent.press(screen.getByTestId('pick-poland'));
    expect(screen.getByText('Страна: Польша')).toBeTruthy();
    expect(screen.getByTestId('travel-note.name').props.value).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('travel-note.story'), STORY);
    expect(screen.getByTestId('travel-note.story-counter')).toHaveTextContent('Текста достаточно для отправки');

    await act(async () => { fireEvent.press(screen.getByTestId('travel-note.submit')); });

    const submitCall = harness.handleManualSave.mock.calls.find(([, options]) => options?.intent === 'submit');
    expect(submitCall?.[0]).toEqual(expect.objectContaining({
      publication_format: 'note',
      categories: [],
      countries: ['160'],
      coordsMeTravel: [expect.objectContaining({ country: 160, categories: [] })],
      description: `<p>${STORY}</p>`,
    }));
    await waitFor(() => expect(screen.getByTestId('travel-note.submitted')).toBeTruthy());
    expect(harness.clearPersistedStep).toHaveBeenCalled();
  });

  it('shows a story restored from the local draft and keeps it on the next keystroke', () => {
    const screen = renderNote(harness, 2);
    fireEvent.changeText(screen.getByTestId('travel-note.story'), 'Черновик\n');
    // Свой ввод (пустая строка в конце) не сбрасывается при пересборке HTML.
    expect(screen.getByTestId('travel-note.story').props.value).toBe('Черновик\n');

    act(() => {
      externalSetFormData?.({
        ...getEmptyFormData(null),
        publication_format: 'note',
        description: `<p>${STORY}</p>`,
      });
    });
    expect(screen.getByTestId('travel-note.story').props.value).toBe(STORY);

    fireEvent.changeText(screen.getByTestId('travel-note.story'), `${STORY} Ещё.`);
    expect(screen.getByTestId('travel-note.story').props.value).toBe(`${STORY} Ещё.`);
  });

  it('does not save a place without a country and lists what is missing instead of sending', async () => {
    const screen = renderNote(harness, 2);
    fireEvent.press(screen.getByTestId('pick-nowhere'));
    expect(screen.getByText(/Не удалось определить страну/)).toBeTruthy();
    expect(harness.handleManualSave).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('travel-note.story'), 'Коротко.');
    expect(screen.getByTestId('travel-note.story-counter')).toHaveTextContent(/Ещё 42 символа до отправки/);

    await act(async () => { fireEvent.press(screen.getByTestId('travel-note.submit')); });
    expect(harness.handleManualSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('travel-note.issues')).toBeTruthy();
    expect(screen.getByText('Добавьте фото: от 1 до 10')).toBeTruthy();
    expect(screen.getByText('Выберите одно место')).toBeTruthy();
  });
});
