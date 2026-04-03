import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/hooks/useTheme';
import RightColumn from '@/components/listTravel/RightColumn';

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    FlashList: React.forwardRef((props: any, ref: any) => {
      const existingRefValue = ref && typeof ref === 'object' ? ref.current : null;
      React.useImperativeHandle(ref, () => ({
        ...existingRefValue,
        scrollToOffset: existingRefValue?.scrollToOffset ?? jest.fn(),
      }));

      return (
        <View testID={props.testID || 'flashlist-mock'}>
          {props.ListHeaderComponent ?? null}
          {Array.isArray(props.data)
            ? props.data.map((item: any, index: number) => (
                <React.Fragment key={`flashlist-item-${index}`}>
                  {props.renderItem?.({ item, index })}
                </React.Fragment>
              ))
            : null}
          {props.ListFooterComponent ?? null}
        </View>
      );
    }),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/components/mainPage/StickySearchBar', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockStickySearchBar(props: any) {
    return React.createElement(
      Pressable,
      {
        testID: 'sticky-search-bar-mock',
        onPress: props?.onToggleRecommendations,
      },
      React.createElement(Text, null, props?.search ?? '')
    );
  };
});

jest.mock('@/components/listTravel/RecommendationsTabs', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockRecommendationsTabs() {
    return React.createElement(Text, { testID: 'recommendations-tabs-mock' }, 'recommendations');
  };
});

jest.mock('@/components/ui/SkeletonLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    TravelListSkeleton: () => React.createElement(Text, { testID: 'travel-list-skeleton-mock' }, 'skeleton'),
  };
});

jest.mock('@/components/ui/EmptyState', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockEmptyState(props: any) {
    return React.createElement(Text, { testID: 'empty-state-mock' }, props?.title ?? 'empty');
  };
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('RightColumn layout invariants', () => {
  const travels: any[] = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
    { id: 4, name: 'D' },
    { id: 5, name: 'E' },
  ];

  const renderItem = (t: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: `travel-card-${String(t.id)}` }, t.name);
  };

  it('forces 1 column on mobile regardless of gridColumns prop', () => {
    renderWithProviders(
      <RightColumn
        search=""
        setSearch={jest.fn()}
        isRecommendationsVisible={false}
        handleRecommendationsVisibilityChange={jest.fn()}
        activeFiltersCount={0}
        total={travels.length}
        contentPadding={16}
        showInitialLoading={false}
        isError={false}
        showEmptyState={false}
        getEmptyStateMessage={null}
        travels={travels as any}
        gridColumns={3}
        isMobile={true}
        showNextPageLoading={false}
        refetch={jest.fn()}
        renderItem={renderItem as any}
      />
    );

    // Expect one item per row (5 rows)
    for (let i = 0; i < travels.length; i++) {
      expect(screen.getByTestId(`travel-row-${i}`)).toBeTruthy();
      expect(screen.getByTestId(`travel-row-${i}-item-0`)).toBeTruthy();
      expect(screen.queryByTestId(`travel-row-${i}-item-1`)).toBeNull();
    }
  });

  it('splits rows by gridColumns on non-mobile', () => {
    renderWithProviders(
      <RightColumn
        search=""
        setSearch={jest.fn()}
        isRecommendationsVisible={false}
        handleRecommendationsVisibilityChange={jest.fn()}
        activeFiltersCount={0}
        total={travels.length}
        contentPadding={16}
        showInitialLoading={false}
        isError={false}
        showEmptyState={false}
        getEmptyStateMessage={null}
        travels={travels as any}
        gridColumns={2}
        isMobile={false}
        showNextPageLoading={false}
        refetch={jest.fn()}
        renderItem={renderItem as any}
      />
    );

    // 5 items with 2 columns => 3 rows
    expect(screen.getByTestId('travel-row-0')).toBeTruthy();
    expect(screen.getByTestId('travel-row-0-item-0')).toBeTruthy();
    expect(screen.getByTestId('travel-row-0-item-1')).toBeTruthy();

    expect(screen.getByTestId('travel-row-1')).toBeTruthy();
    expect(screen.getByTestId('travel-row-1-item-0')).toBeTruthy();
    expect(screen.getByTestId('travel-row-1-item-1')).toBeTruthy();

    expect(screen.getByTestId('travel-row-2')).toBeTruthy();
    expect(screen.getByTestId('travel-row-2-item-0')).toBeTruthy();
    expect(screen.queryByTestId('travel-row-2-item-1')).toBeNull();

    expect(screen.queryByTestId('travel-row-3')).toBeNull();
  });

  it('scrolls to recommendations after toggling them on', async () => {
    const listRef = {
      current: {
        scrollToOffset: jest.fn(),
      },
    } as any;

    const StatefulWrapper = () => {
      const [visible, setVisible] = React.useState(false);

      return (
        <RightColumn
          search=""
          setSearch={jest.fn()}
          isRecommendationsVisible={visible}
          handleRecommendationsVisibilityChange={setVisible}
          activeFiltersCount={0}
          total={travels.length}
          contentPadding={16}
          showInitialLoading={false}
          isError={false}
          showEmptyState={false}
          getEmptyStateMessage={null}
          travels={travels as any}
          gridColumns={1}
          isMobile={true}
          showNextPageLoading={false}
          refetch={jest.fn()}
          renderItem={renderItem as any}
          listRef={listRef}
        />
      );
    };

    renderWithProviders(<StatefulWrapper />);

    fireEvent.press(screen.getByTestId('sticky-search-bar-mock'));

    const header = await screen.findByTestId('recommendations-list-header');
    fireEvent(header, 'layout', { nativeEvent: { layout: { y: 184, height: 376, width: 320 } } });

    await waitFor(() => {
      expect(listRef.current.scrollToOffset).toHaveBeenCalledWith({
        offset: 176,
        animated: true,
      });
    });
  });

  it('rerenders when renderItem changes while travels length stays the same', () => {
    const { rerender } = renderWithProviders(
      <RightColumn
        search=""
        setSearch={jest.fn()}
        isRecommendationsVisible={false}
        handleRecommendationsVisibilityChange={jest.fn()}
        activeFiltersCount={0}
        total={travels.length}
        contentPadding={16}
        showInitialLoading={false}
        isError={false}
        showEmptyState={false}
        getEmptyStateMessage={null}
        travels={travels as any}
        gridColumns={2}
        isMobile={false}
        showNextPageLoading={false}
        refetch={jest.fn()}
        renderItem={(t: any) => {
          const React = require('react');
          const { Text } = require('react-native');
          return React.createElement(Text, { testID: `travel-card-${String(t.id)}` }, `off-${t.id}`);
        }}
      />
    );

    expect(screen.getByText('off-1')).toBeTruthy();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <ThemeProvider>
          <RightColumn
            search=""
            setSearch={jest.fn()}
            isRecommendationsVisible={false}
            handleRecommendationsVisibilityChange={jest.fn()}
            activeFiltersCount={0}
            total={travels.length}
            contentPadding={16}
            showInitialLoading={false}
            isError={false}
            showEmptyState={false}
            getEmptyStateMessage={null}
            travels={travels as any}
            gridColumns={2}
            isMobile={false}
            showNextPageLoading={false}
            refetch={jest.fn()}
            renderItem={(t: any) => {
              const React = require('react');
              const { Text } = require('react-native');
              return React.createElement(Text, { testID: `travel-card-${String(t.id)}` }, `on-${t.id}`);
            }}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('on-1')).toBeTruthy();
  });

  it('keeps the visible results subtree stable when only search text changes', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const renderItem = jest.fn((t: any) => {
      const React = require('react');
      const { Text } = require('react-native');
      return React.createElement(Text, { testID: `travel-card-${String(t.id)}` }, t.name);
    });

    const baseProps = {
      setSearch: jest.fn(),
      isRecommendationsVisible: false,
      handleRecommendationsVisibilityChange: jest.fn(),
      activeFiltersCount: 0,
      total: travels.length,
      contentPadding: 16,
      showInitialLoading: false,
      isError: false,
      showEmptyState: false,
      getEmptyStateMessage: null,
      travels: travels as any,
      gridColumns: 2,
      isMobile: false,
      showNextPageLoading: false,
      refetch: jest.fn(),
      renderItem: renderItem as any,
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RightColumn
            {...baseProps}
            search=""
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    const initialRenderCalls = renderItem.mock.calls.length;
    expect(initialRenderCalls).toBeGreaterThan(0);

    rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RightColumn
            {...baseProps}
            search="минск"
          />
        </ThemeProvider>
      </QueryClientProvider>
    );

    expect(renderItem.mock.calls).toHaveLength(initialRenderCalls);
  });
});
