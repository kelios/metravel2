// ResultsCounter.test.tsx - Тесты для компонента ResultsCounter
import React from 'react';
import { render } from '@testing-library/react-native';
import ResultsCounter from '@/components/listTravel/ResultsCounter';

// Mock Platform
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  };
});

describe('ResultsCounter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading indicator when isLoading is true', () => {
      const { getByText, UNSAFE_getByType } = render(
        <ResultsCounter count={0} isLoading={true} />
      );
      
      expect(getByText('Загрузка...')).toBeTruthy();
      expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
    });

    it('does not show count when loading', () => {
      const { queryByText } = render(
        <ResultsCounter count={100} isLoading={true} />
      );
      
      expect(queryByText('100')).toBeNull();
    });
  });

  describe('Count formatting', () => {
    it('displays zero correctly', () => {
      const { getByText } = render(<ResultsCounter count={0} />);
      
      expect(getByText('Пока нет путешествий')).toBeTruthy();
    });

    it('displays small numbers correctly', () => {
      const { getByText } = render(<ResultsCounter count={5} />);
      
      expect(getByText('Всего 5 путешествий')).toBeTruthy();
    });

    it('displays numbers less than 1000 correctly', () => {
      const { getByText } = render(<ResultsCounter count={999} />);
      
      expect(getByText('Всего 999 путешествий')).toBeTruthy();
    });

    it('formats thousands correctly', () => {
      const { getByText } = render(<ResultsCounter count={1500} />);
      
      expect(getByText('Всего 1.5k путешествий')).toBeTruthy();
    });

    it('formats millions correctly', () => {
      const { getByText } = render(<ResultsCounter count={2500000} />);
      
      expect(getByText('Всего 2.5M путешествий')).toBeTruthy();
    });
  });

  describe('Pluralization', () => {
    it('uses correct form for 1', () => {
      const { getByText } = render(<ResultsCounter count={1} />);
      
      expect(getByText('Всего 1 путешествие')).toBeTruthy();
    });

    it('uses correct form for 2-4', () => {
      const { getByText } = render(<ResultsCounter count={2} />);
      
      expect(getByText('Всего 2 путешествия')).toBeTruthy();
    });

    it('uses correct form for 5-20', () => {
      const { getByText } = render(<ResultsCounter count={5} />);
      
      expect(getByText('Всего 5 путешествий')).toBeTruthy();
    });

    it('uses correct form for 21', () => {
      const { getByText } = render(<ResultsCounter count={21} />);
      
      expect(getByText('Всего 21 путешествие')).toBeTruthy();
    });

    it('uses correct form for 22-24', () => {
      const { getByText } = render(<ResultsCounter count={22} />);
      
      expect(getByText('Всего 22 путешествия')).toBeTruthy();
    });

    it('uses correct form for 101', () => {
      const { getByText } = render(<ResultsCounter count={101} />);
      
      expect(getByText('Всего 101 путешествие')).toBeTruthy();
    });
  });

  describe('Query messages', () => {
    it('shows message with query', () => {
      const { getByText } = render(
        <ResultsCounter count={10} query="Париж" />
      );
      
      expect(getByText('Найдено 10 путешествий по запросу "Париж"')).toBeTruthy();
    });

    it('uses correct plural form with query', () => {
      const { getByText } = render(
        <ResultsCounter count={1} query="Париж" />
      );
      
      expect(getByText('Найдено 1 путешествие по запросу "Париж"')).toBeTruthy();
    });
  });

  describe('Filter messages', () => {
    it('shows message with filters', () => {
      const { getByText } = render(
        <ResultsCounter count={15} hasFilters={true} />
      );
      
      expect(getByText('Найдено 15 путешествий')).toBeTruthy();
    });

    it('shows "nothing found" when count is 0 with filters', () => {
      const { getByText } = render(
        <ResultsCounter count={0} hasFilters={true} />
      );
      
      expect(getByText('Ничего не найдено')).toBeTruthy();
    });

    it('shows "nothing found" when count is 0 with query', () => {
      const { getByText } = render(
        <ResultsCounter count={0} query="test" />
      );
      
      expect(getByText('Ничего не найдено')).toBeTruthy();
    });
  });

  describe('Default message', () => {
    it('shows default message when no query and no filters', () => {
      const { getByText } = render(<ResultsCounter count={100} />);
      
      expect(getByText('Всего 100 путешествий')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility live region', () => {
      const { getByRole } = render(<ResultsCounter count={10} />);
      
      const text = getByRole('text');
      expect(text.props.accessibilityLiveRegion).toBe('polite');
    });
  });

  describe('Edge cases', () => {
    it('handles large numbers correctly', () => {
      const { getByText } = render(<ResultsCounter count={999999} />);
      
      expect(getByText('Всего 1000.0k путешествий')).toBeTruthy();
    });

    it('handles zero with query', () => {
      const { getByText } = render(
        <ResultsCounter count={0} query="nonexistent" />
      );
      
      expect(getByText('Ничего не найдено')).toBeTruthy();
    });

    it('handles zero with filters', () => {
      const { getByText } = render(
        <ResultsCounter count={0} hasFilters={true} />
      );
      
      expect(getByText('Ничего не найдено')).toBeTruthy();
    });

    it('prioritizes query over filters in message', () => {
      const { getByText } = render(
        <ResultsCounter count={10} query="test" hasFilters={true} />
      );
      
      expect(getByText(/по запросу "test"/)).toBeTruthy();
    });
  });
});

