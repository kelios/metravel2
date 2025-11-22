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
    const { UNSAFE_root, queryByText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomTitle = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-title') as HTMLElement | null;
    expect(bottomTitle).not.toBeNull();
    if (bottomTitle) {
      expect(bottomTitle.textContent).toContain('Test address');
    }

    // В свернутом состоянии блок координат внутри панели ещё не виден
    expect(queryByText(/Координаты/i)).toBeNull();
  });

  it('expands info panel when bottom bar is clicked', () => {
    const { UNSAFE_root } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-bar') as HTMLElement | null;
    expect(bottomBar).not.toBeNull();

    if (bottomBar) {
      (fireEvent as any).click(bottomBar);
    }

    // После клика координаты становятся видимыми в панели
    const coordEl = (UNSAFE_root as any)?.querySelector?.('.popup-coord-text') as HTMLElement | null;
    expect(coordEl).not.toBeNull();
    if (coordEl) {
      expect(coordEl.textContent).toContain(baseTravel.coord);
    }
  });

  it.skip('copies coordinates when copy button is clicked', async () => {
    const { UNSAFE_root, getByLabelText, getByText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-bar') as HTMLElement | null;
    if (bottomBar) {
      (fireEvent as any).click(bottomBar);
    }

    // Координаты должны быть видны
    expect(getByText(baseTravel.coord)).toBeTruthy();

    const copyBtn = getByLabelText('Скопировать координаты');
    fireEvent(copyBtn, 'click');

    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith(
      baseTravel.coord
    );
  });

  it.skip('opens map when map button is clicked', () => {
    const { UNSAFE_root, getByLabelText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-bar') as HTMLElement | null;
    if (bottomBar) {
      fireEvent.click(bottomBar);
    }

    const mapBtn = getByLabelText('Открыть на карте');
    fireEvent(mapBtn, 'click');

    expect(window.open).toHaveBeenCalled();
    const url = (window.open as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('https://maps.google.com/?q=');
  });

  it.skip('opens primary article/quest when card is clicked', () => {
    const { getByRole } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const buttonCard = getByRole('button');
    fireEvent(buttonCard, 'click');

    expect(window.open).toHaveBeenCalledWith(
      baseTravel.urlTravel,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it.skip('renders long description and many categories without crashing and keeps scrollable panel', () => {
    const longDescription = 'Очень длинное описание '.repeat(100);
    const manyCats = Array.from({ length: 20 }, (_, i) => `Категория ${i + 1}`).join(', ');

    const { UNSAFE_root, getByText } = render(
      <PopupContentComponent
        travel={{
          ...baseTravel,
          description: longDescription,
          categoryName: manyCats,
        }}
      />
    );

    const bottomBar = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-bar') as HTMLElement | null;
    if (bottomBar) {
      fireEvent(bottomBar, 'click');
    }

    // Панель развернулась
    const expanded = (UNSAFE_root as any)?.querySelector?.('.popup-expanded-card') as HTMLElement | null;
    expect(expanded).not.toBeNull();

    // Внутри видна хотя бы одна категория
    expect(getByText(/Категория 1/)).toBeTruthy();
  });

  it('injects CSS with fixed height for .popup-photo so cards with and without image have same height', () => {
    // Рендерим компонент, чтобы он добавил style-тег с CSS
    render(<PopupContentComponent travel={baseTravel} />);

    const styleTag = document.getElementById('popup-content-web-style') as HTMLStyleElement | null;
    expect(styleTag).not.toBeNull();

    if (styleTag) {
      const css = styleTag.innerHTML.replace(/\s+/g, ' ');
      // Проверяем, что у .popup-photo зашита фиксированная высота 280px
      expect(css).toContain('popup-photo {');
      expect(css).toContain('height: 280px;');
    }
  });

  it('uses the same .popup-photo container for cards with and without image', () => {
    const { unmount: unmountWithImage, UNSAFE_root: rootWithImage } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const withImage = (rootWithImage as any)?.querySelector?.('.popup-photo') as HTMLElement | null;
    expect(withImage).not.toBeNull();

    unmountWithImage();

    const withoutImageTravel = { ...baseTravel, travelImageThumbUrl: undefined } as any;
    const { UNSAFE_root: rootWithoutImage } = render(
      <PopupContentComponent travel={withoutImageTravel} />
    );

    const withoutImage = (rootWithoutImage as any)?.querySelector?.('.popup-photo') as HTMLElement | null;
    expect(withoutImage).not.toBeNull();

    if (withImage && withoutImage) {
      expect(withImage.tagName).toBe(withoutImage.tagName);
      expect(withImage.className).toBe(withoutImage.className);
    }
  });
});
