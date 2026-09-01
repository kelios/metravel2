import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { PublicProfileTravelsTab } from '@/components/screens/profile/PublicProfileTravelsTab';
import { CARD_MEDIA_SLOT_RATIO } from '@/components/listTravel/travelListItemHelpers';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { Travel } from '@/types/types';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));

const mockUnifiedTravelCard = jest.fn<any, [any]>(() => null);

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedTravelCard(props),
}));

describe('PublicProfileTravelsTab', () => {
  beforeEach(() => {
    mockUnifiedTravelCard.mockClear();
  });

  it('loads more routes inside the profile instead of navigating away', () => {
    const onLoadMore = jest.fn();
    const travel = { id: 1, name: 'Маршрут' } as Travel;
    const { getByRole, queryByText } = render(
      <PublicProfileTravelsTab
        travels={[travel]}
        total={13}
        isLoading={false}
        isError={false}
        isMobile={false}
        onOpenTravel={jest.fn()}
        onLoadMore={onLoadMore}
      />
    );

    fireEvent.press(getByRole('button', { name: 'Показать ещё путешествия автора' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(queryByText('Смотреть все (13)')).toBeNull();
  });

  it('заливает поля letterbox доминирующим цветом обложки, а не общим blurhash', () => {
    // На web blurhash в подложку не идёт вовсе, поэтому один хардкоженый хеш
    // оставлял `contain`-фото автора без фона.
    const travel = {
      id: 2,
      name: 'Адршпашские скалы',
      media: { cover: { id: 2, blurhash: 'LKO2:N%2Tw=w]~RBVZRi};RPxuwH', dominant_color: '#4d5a52' } },
    } as unknown as Travel;

    render(
      <PublicProfileTravelsTab
        travels={[travel]}
        total={1}
        isLoading={false}
        isError={false}
        isMobile
        onOpenTravel={jest.fn()}
        onLoadMore={jest.fn()}
      />
    );

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaProps?.placeholderColor).toBe('#4d5a52');
    expect(props.mediaProps?.placeholderBlurhash).toBe('LKO2:N%2Tw=w]~RBVZRi};RPxuwH');
  });

  it('#1674: слот живёт на пропорции, а ширина растра — оценка СВЕРХУ', () => {
    // Пиксельная высота при резиновой ширине карточки и была дефектом #1674:
    // квадратная обложка (мода прод-выдачи) вписывалась в низкий широкий бокс
    // и оставляла полосы `dominant_color` сверху и снизу.
    const travel = { id: 4, name: 'Слот' } as Travel;

    render(
      <PublicProfileTravelsTab
        travels={[travel]}
        total={1}
        isLoading={false}
        isError={false}
        isMobile
        onOpenTravel={jest.fn()}
        onLoadMore={jest.fn()}
      />
    );

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaAspectRatio).toBe(CARD_MEDIA_SLOT_RATIO);
    expect(props.imageHeight).toBeUndefined();

    // #1103: `mediaSlotWidth` идёт только в сайзинг растра, и занижение выбирает
    // мелкую ступень — фото становится мылом. Поэтому оценка обязана быть не
    // меньше реальной ширины карточки: на native это строка целиком за вычетом
    // собственных полей вкладки, на web — потолок `maxWidth` карточки.
    const nativeCardWidth = Dimensions.get('window').width - DESIGN_TOKENS.spacing.md * 2;
    expect(props.mediaSlotWidth).toBeGreaterThanOrEqual(
      Platform.OS === 'web' ? 460 : nativeCardWidth
    );
  });

  it('оставляет общий blurhash только когда у обложки нет ни хеша, ни цвета', () => {
    const travel = { id: 3, name: 'Старый payload' } as Travel;

    render(
      <PublicProfileTravelsTab
        travels={[travel]}
        total={1}
        isLoading={false}
        isError={false}
        isMobile
        onOpenTravel={jest.fn()}
        onLoadMore={jest.fn()}
      />
    );

    const props = mockUnifiedTravelCard.mock.calls.at(-1)?.[0] as any;
    expect(props.mediaProps?.placeholderBlurhash).toBe('LEHL6nWB2yk8pyo0adR*.7kCMdnj');
    expect(props.mediaProps?.placeholderColor).toBeNull();
  });
});
