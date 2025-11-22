import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PopupContentComponent from '@/components/MapPage/PopupContentComponent';

const baseTravel = {
  address: 'Test address, City, Country',
  coord: '50.4450230,19.7690499',
  travelImageThumbUrl: 'https://example.com/image.jpg',
  categoryName: 'Башня, Обзорная точка',
  description: 'Краткое описание локации для проверки рендера.',
  articleUrl: 'https://example.com/article',
  urlTravel: 'https://example.com/quest',
};

describe('PopupContentComponent (web popup template)', () => {
  const originalOpen = window.open;
  const originalClipboard = (navigator as any).clipboard;

  beforeEach(() => {
    window.open = jest.fn();
    (navigator as any).clipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    window.open = originalOpen;
    (navigator as any).clipboard = originalClipboard;
    jest.clearAllMocks();
  });

  it('renders collapsed card with address in bottom bar', () => {
    const { getByText, queryByText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    // Адрес в нижней плашке (усечённый при необходимости)
    expect(getByText(/Test address/)).toBeTruthy();

    // В свернутом состоянии блок координат внутри панели ещё не виден
    expect(queryByText(/Координаты/i)).toBeNull();
  });

  it('expands info panel when bottom bar is clicked', () => {
    const { container, getByText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = container.querySelector('.popup-bottom-bar');
    expect(bottomBar).not.toBeNull();

    if (bottomBar) {
      fireEvent.click(bottomBar);
    }

    // После клика появляется заголовок панели и блок координат
    expect(getByText(/Координаты/i)).toBeTruthy();
    expect(getByText(baseTravel.coord)).toBeTruthy();
  });

  it('copies coordinates when copy button is clicked', async () => {
    const { container, getByLabelText, getByText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = container.querySelector('.popup-bottom-bar');
    if (bottomBar) {
      fireEvent.click(bottomBar);
    }

    // Координаты должны быть видны
    expect(getByText(baseTravel.coord)).toBeInTheDocument();

    const copyBtn = getByLabelText('Скопировать координаты');
    fireEvent.click(copyBtn);

    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith(
      baseTravel.coord
    );
  });

  it('opens map when map button is clicked', () => {
    const { container, getByLabelText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = container.querySelector('.popup-bottom-bar');
    if (bottomBar) {
      fireEvent.click(bottomBar);
    }

    const mapBtn = getByLabelText('Открыть на карте');
    fireEvent.click(mapBtn);

    expect(window.open).toHaveBeenCalled();
    const url = (window.open as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('https://maps.google.com/?q=');
  });

  it('opens primary article/quest when card is clicked', () => {
    const { getByRole } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const buttonCard = getByRole('button');
    fireEvent.click(buttonCard);

    expect(window.open).toHaveBeenCalledWith(
      baseTravel.urlTravel,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders long description and many categories without crashing and keeps scrollable panel', () => {
    const longDescription = 'Очень длинное описание '.repeat(100);
    const manyCats = Array.from({ length: 20 }, (_, i) => `Категория ${i + 1}`).join(', ');

    const { container, getByText } = render(
      <PopupContentComponent
        travel={{
          ...baseTravel,
          description: longDescription,
          categoryName: manyCats,
        }}
      />
    );

    const bottomBar = container.querySelector('.popup-bottom-bar');
    if (bottomBar) {
      fireEvent.click(bottomBar);
    }

    // Панель развернулась
    const expanded = container.querySelector('.popup-expanded-card') as HTMLElement | null;
    expect(expanded).not.toBeNull();

    // Внутри виден фрагмент длинного описания и хотя бы одна категория
    expect(getByText(/Очень длинное описание/)).toBeTruthy();
    expect(getByText(/Категория 1/)).toBeTruthy();
  });
});
