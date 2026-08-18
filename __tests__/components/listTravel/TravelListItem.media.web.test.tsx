import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import TravelListItem from '@/components/listTravel/TravelListItem';
import { normalizeToTravel } from '@/components/profile/travelNormalize';
import type { Travel } from '@/types/types';

const mockUnifiedTravelCard = jest.fn<any, [any]>(() => null);

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}));

jest.mock('expo-router', () => {
  const push = jest.fn();
  return {
    router: { push },
    useRouter: () => ({ push }),
    usePathname: () => '',
  };
});

jest.mock('@/components/travel/FavoriteButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'web',
    select: jest.fn((obj) => obj.web || obj.default),
  },
  OS: 'web',
  select: jest.fn((obj) => obj.web || obj.default),
}));

const baseTravel: Travel = {
  id: 1,
  name: 'Test travel',
  slug: 'test-travel',
  travel_image_thumb_url: 'https://example.com/image.jpg',
  url: '/travels/test-travel',
  userName: 'Author',
  userIds: '42',
  countryName: 'Беларусь',
  countUnicIpView: '12',
  gallery: [],
  travelAddress: [],
  year: '',
  monthName: '',
  number_days: 0,
  companions: [],
  countryCode: '',
} as any;

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderItem = (props: Partial<React.ComponentProps<typeof TravelListItem>> = {}) => {
  const queryClient = createTestClient();

  const createItem = (nextProps: Partial<React.ComponentProps<typeof TravelListItem>>) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FavoritesProvider>
          <TravelListItem
            travel={baseTravel}
            currentUserId={null}
            isSuperuser={false}
            isMetravel={false}
            isMobile={false}
            {...nextProps}
          />
        </FavoritesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );

  const rendered = render(createItem(props));
  return {
    ...rendered,
    rerenderItem: (nextProps: Partial<React.ComponentProps<typeof TravelListItem>>) =>
      rendered.rerender(createItem(nextProps)),
  };
};

describe('TravelListItem media props on web', () => {
  const originalUserAgent = window.navigator.userAgent;
  const originalMaxTouchPoints = window.navigator.maxTouchPoints;
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    mockUnifiedTravelCard.mockClear();
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
  });

  it('keeps blur background enabled for default list cards', () => {
    renderItem();

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.blurBackground).toBe(true);
  });

  it('renders default list cards without inset media shell gaps', () => {
    renderItem();

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.insetMedia).toBe(false);
  });

  it('does not pass a fixed width to the web card when grid slot already controls layout', () => {
    renderItem({ cardWidth: 320, viewportWidth: 1280 });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.width).toBeUndefined();
  });

  it('keeps search-card media hidden until decode on iPhone Safari', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    });

    renderItem({ isFirst: true, isMobile: true });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.revealOnLoadOnly).toBe(true);
  });

  it('decode-gates every web search card and keeps non-critical requests low priority', () => {
    renderItem({ isFirst: false, isMobile: false });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.revealOnLoadOnly).toBe(true);
    expect(props.mediaProps?.priority).toBe('low');
    expect(props.mediaProps?.loading).toBe('eager');
    expect(props.mediaProps?.prefetch).toBe(false);
    expect(props.mediaProps?.placeholderSrc).toBeUndefined();
  });

  it('keeps only the first row high priority', () => {
    renderItem({ isFirst: true });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaProps?.priority).toBe('high');
    expect(props.mediaProps?.loading).toBe('eager');
    expect(props.mediaProps?.prefetch).toBe(false);
  });

  it('applies the catalog lazy policy through the memo boundary after scrolling', () => {
    const { rerenderItem } = renderItem({ isFirst: true, mediaLoading: 'eager' });

    expect(mockUnifiedTravelCard.mock.calls.at(-1)?.[0]?.mediaProps?.loading).toBe('eager');

    rerenderItem({ isFirst: false, mediaLoading: 'lazy' });

    expect(mockUnifiedTravelCard).toHaveBeenCalledTimes(2);
    expect(mockUnifiedTravelCard.mock.calls.at(-1)?.[0]?.mediaProps).toMatchObject({
      loading: 'lazy',
      priority: 'low',
      prefetch: false,
      retainWebRequestOnRecycle: true,
    });
  });

  it('uses compact owner controls on mobile web cards', () => {
    renderItem({ currentUserId: '42', isMobile: true });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    const leftTopSlot = props?.leftTopSlot;
    expect(leftTopSlot).toBeTruthy();

    const adminStyle = StyleSheet.flatten(leftTopSlot.props.style);
    expect(adminStyle.top).toBe(8);
    expect(adminStyle.left).toBe(8);
    expect(adminStyle.paddingHorizontal).toBe(5);
  });

  it('passes backend media variants without requesting a separate lqip on web', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: {
          cover: {
            id: 11,
            lqip_url: '/gallery/11/cover.webp?w=32&q=35&fit=cover',
            variants: {
              thumb_160: '/gallery/11/cover.webp?w=160&q=70&fit=cover',
              thumb_320: '/gallery/11/cover.webp?w=320&q=72&fit=cover',
              card_640: '/gallery/11/cover.webp?w=640&q=75&fit=cover',
            },
            sizes_hint: '(max-width: 768px) 100vw, 320px',
          },
          gallery: null,
          address_images: null,
        },
      } as any,
      viewportWidth: 1280,
    });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props).toBeTruthy();
    expect(props.mediaProps?.placeholderSrc).toBeUndefined();
    // #1285: карточка просит явное качество, поэтому `q` манифеста переписывается
    // (замер прода: −21…23 % байт без видимой потери).
    expect(props.mediaProps?.webResponsiveSource?.src).toBe(
      'https://metravel.by/gallery/11/cover.webp?w=640&q=70&fit=cover',
    );
    expect(props.mediaProps?.webResponsiveSource?.srcSet).toContain('160w');
    expect(props.mediaProps?.webResponsiveSource?.srcSet).toContain('320w');
    expect(props.mediaProps?.webResponsiveSource?.srcSet).toContain('640w');
  });

  it('does not advertise cover candidates wider than the card needs', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: {
          cover: {
            id: 12,
            variants: {
              thumb_160: '/gallery/12/cover.webp?w=160',
              thumb_320: '/gallery/12/cover.webp?w=320',
              card_480: '/gallery/12/cover.webp?w=480',
              card_640: '/gallery/12/cover.webp?w=640',
              card_720: '/gallery/12/cover.webp?w=720',
              card_960: '/gallery/12/cover.webp?w=960',
            },
          },
          gallery: null,
          address_images: null,
        },
      } as any,
      cardWidth: 408,
      viewportWidth: 1280,
    });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    const srcSet: string = props.mediaProps?.webResponsiveSource?.srcSet ?? '';
    // На DPR 2 браузер берёт самого широкого кандидата, который влезает в `sizes`.
    // Лестница выше 640w тянула в бокс ~390 px почти оригинал (≈3 МБ обложек на
    // страницу выдачи) и душила fetch следующей страницы.
    expect(srcSet).toContain('640w');
    expect(srcSet).not.toContain('720w');
    expect(srcSet).not.toContain('960w');
  });

  it('keeps a candidate that covers cards wider than the default ladder cap', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: {
          cover: {
            id: 13,
            variants: {
              thumb_320: '/gallery/13/cover.webp?w=320',
              card_480: '/gallery/13/cover.webp?w=480',
              card_640: '/gallery/13/cover.webp?w=640',
              card_720: '/gallery/13/cover.webp?w=720',
              card_960: '/gallery/13/cover.webp?w=960',
            },
          },
          gallery: null,
          address_images: null,
        },
      } as any,
      cardWidth: 700,
      viewportWidth: 1600,
    });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    const srcSet: string = props.mediaProps?.webResponsiveSource?.srcSet ?? '';
    // Обрезать лестницу строго по `<= maxWidth` нельзя: карточке 700 px достался
    // бы 640w, то есть картинка мельче собственного бокса.
    expect(srcSet).toContain('720w');
    expect(srcSet).not.toContain('960w');
  });

  it('forwards backend blurhash instead of the generic card placeholder', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: {
          cover: {
            id: 11,
            blurhash: 'LEHL6nWB2yk8pyo0adR*.7kCMdnj',
            dominant_color: '#123456',
            lqip_url: '/gallery/11/cover-lqip.webp',
          },
        },
      } as any,
    });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaProps?.placeholderBlurhash).toBe('LEHL6nWB2yk8pyo0adR*.7kCMdnj');
    // Оба поля прокидываются вместе: web заливает поля цветом, native рисует blurhash.
    expect(props.mediaProps?.placeholderColor).toBe('#123456');
    expect(props.mediaProps?.placeholderSrc).toBeUndefined();
  });

  it('keeps the letterbox fill for a card built from the profile payload', () => {
    // Профиль не отдаёт `Travel` напрямую: список проходит через
    // `normalizeToTravel`, и раньше тот терял `media`. Карточка оставалась без
    // `placeholderColor`, то есть без единственной web-подложки под
    // `contain`-фото — на телефоне фото висело на голом фоне карточки.
    const travel = normalizeToTravel({
      id: 21,
      name: 'Озеро Букувка',
      url: '/travels/ozero-bukuvka',
      travel_image_thumb_url: 'https://metravel.by/travel-image/21/thumb.webp',
      media: {
        cover: {
          id: 21,
          dominant_color: '#666b6d',
          variants: { card_640: '/travel-image/21/cover.webp?w=640' },
        },
      },
    });

    renderItem({ travel, isMobile: true, viewportWidth: 390 });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaProps?.placeholderColor).toBe('#666b6d');
    expect(props.mediaProps?.webResponsiveSource?.src).toBe(
      'https://metravel.by/travel-image/21/cover.webp?w=640&q=70',
    );
  });

  // INV2-17: карточка кадрируется `cover` — кадр заполняет весь бокс при любой
  // ориентации, поэтому `sizes` объявляет ширину БОКСА, а не draw-width портрета
  // (draw-width оптимизация #1285 для `cover` неприменима: она увела бы `sizes`
  // ниже ширины бокса и дала мыло). Лестница ограничена потолком бокса (DPR 2).
  it('объявляет в sizes ширину БОКСА (cover), а не draw-width портрета', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: {
          cover: {
            id: 14,
            width: 800,
            height: 800,
            aspect_ratio: 1,
            srcset: [
              '/travel-image/14/conversions/c.webp?w=160 160w',
              '/travel-image/14/conversions/c.webp?w=320 320w',
              '/travel-image/14/conversions/c.webp?w=480 480w',
              '/travel-image/14/conversions/c.webp?w=640 640w',
              '/travel-image/14/conversions/c.webp?w=960 960w',
            ].join(', '),
          },
          gallery: null,
          address_images: null,
        },
      } as any,
      cardWidth: 320,
      imageHeight: 200,
      isMobile: true,
      viewportWidth: 412,
    });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    const source = props.mediaProps?.webResponsiveSource;
    // Бокс 320 → `sizes` = ширина бокса. На DPR 2 (320 × 2 = 640) лестница
    // держит retina-ступень 640w; выше бокса (960w) кандидатов нет.
    expect(source?.sizes).toBe('320px');
    expect(source?.srcSet).toContain('640w');
    expect(source?.srcSet).not.toContain('960w');
    expect(source?.src).toContain('q=70');
  });

  it('портретная обложка (cover) тоже сайзится по ширине бокса, не по draw-width', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: {
          cover: {
            id: 15,
            width: 640,
            height: 853,
            aspect_ratio: 640 / 853,
            srcset: [
              '/travel-image/15/conversions/c.webp?w=160 160w',
              '/travel-image/15/conversions/c.webp?w=320 320w',
              '/travel-image/15/conversions/c.webp?w=480 480w',
              '/travel-image/15/conversions/c.webp?w=640 640w',
            ].join(', '),
          },
          gallery: null,
          address_images: null,
        },
      } as any,
      cardWidth: 320,
      imageHeight: 200,
      isMobile: true,
      viewportWidth: 412,
    });

    const source = (mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any).mediaProps
      ?.webResponsiveSource;
    // INV2-17: под `cover` портрет заполняет всю ширину бокса (кроп сверху/снизу),
    // поэтому `sizes` = ширина бокса (320px), а не прежние 150px draw-width.
    // Лестница держит retina-ступень 640w для 320px бокса на DPR 2.
    expect(source?.sizes).toBe('320px');
    expect(source?.srcSet).toContain('640w');
  });

  it('uses dominant color when the cover has no blurhash', () => {
    renderItem({
      travel: {
        ...baseTravel,
        media: { cover: { id: 11, blurhash: null, dominant_color: '#234567' } },
      } as any,
    });

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaProps?.placeholderBlurhash).toBeUndefined();
    expect(props.mediaProps?.placeholderColor).toBe('#234567');
  });
});
