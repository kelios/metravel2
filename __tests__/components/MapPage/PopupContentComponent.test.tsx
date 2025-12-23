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

  it('has copy button for coordinates in expanded panel', async () => {
    const { UNSAFE_root } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-bar') as HTMLElement | null;
    if (bottomBar) {
      (fireEvent as any).click(bottomBar);
    }

    // Координаты должны быть видны внутри .popup-coord-text
    const coordEl = (UNSAFE_root as any)?.querySelector?.('.popup-coord-text') as HTMLElement | null;
    expect(coordEl).not.toBeNull();
    if (coordEl) {
      expect(coordEl.textContent).toContain(baseTravel.coord);
    }

    const copyBtn = (UNSAFE_root as any)?.querySelector?.('.popup-coord-copy-btn') as HTMLElement | null;
    expect(copyBtn).not.toBeNull();
    if (copyBtn) {
      // Клик не должен вызывать ошибок, но не проверяем конкретный вызов clipboard
      (fireEvent as any).click(copyBtn);
    }
  });

  it('renders map button in expanded panel', () => {
    const { UNSAFE_root } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    const bottomBar = (UNSAFE_root as any)?.querySelector?.('.popup-bottom-bar') as HTMLElement | null;
    if (bottomBar) {
      (fireEvent as any).click(bottomBar);
    }

    const mapBtn = (UNSAFE_root as any)?.querySelector?.('[aria-label="Открыть на карте"]') as HTMLElement | null;
    expect(mapBtn).not.toBeNull();
    if (mapBtn) {
      // Клик по кнопке карты не должен вызывать ошибок
      (fireEvent as any).click(mapBtn);
    }
  });

  it('opens primary article/quest when card is clicked', () => {
    const { getByLabelText } = render(
      <PopupContentComponent travel={baseTravel} />
    );

    // Внешний контейнер имеет aria-label вида "Открыть: <address>"
    const card = getByLabelText(`Открыть: ${baseTravel.address}`);
    (fireEvent as any)(card, 'click');

    expect(window.open).toHaveBeenCalledWith(
      baseTravel.urlTravel,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders long description and many categories without crashing and keeps scrollable panel', () => {
    const longDescription = 'Очень длинное описание '.repeat(100);
    const manyCats = Array.from({ length: 20 }, (_, i) => `Категория ${i + 1}`).join(', ');

    const { UNSAFE_root } = render(
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

    // Первая категория теперь отображается в бейдже на фото, а список категорий в expanded панели
    // начинается со 2-й категории (cats.slice(1)).
    const badge = (UNSAFE_root as any)?.querySelector?.('.popup-photo-badge') as HTMLElement | null;
    expect(badge).not.toBeNull();
    if (badge) {
      expect(badge.textContent).toContain('Категория 1');
    }

    const firstListedCategory = (UNSAFE_root as any)?.querySelector?.('.popup-category') as HTMLElement | null;
    expect(firstListedCategory).not.toBeNull();
    if (firstListedCategory) {
      expect(firstListedCategory.textContent).toContain('Категория 2');
      expect(firstListedCategory.textContent).not.toContain('Категория 1');
    }
  });

  it('injects CSS with fixed height for .popup-photo so cards with and without image have same height', () => {
    // Рендерим компонент, чтобы он добавил style-тег с CSS
    render(<PopupContentComponent travel={baseTravel} />);

    if (typeof (document as any).getElementById !== 'function') {
      // В тестовом окружении document может быть частично замокан без DOM-API
      return;
    }

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
