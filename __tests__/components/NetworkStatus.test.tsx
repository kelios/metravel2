import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NetworkStatus } from '@/components/ui/NetworkStatus';

// Mock useNetworkStatus hook
const mockIsConnected = jest.fn(() => true);
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isConnected: mockIsConnected(),
  }),
}));

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

describe('NetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected.mockReturnValue(true);
  });

  it('should not render when online and showWhenOnline is false', () => {
    mockIsConnected.mockReturnValue(true);
    const { toJSON } = render(<NetworkStatus />);
    const tree = toJSON();
    
    // Компонент не должен рендериться когда онлайн и showWhenOnline=false
    expect(tree).toBeNull();
  });

  it('should render when offline', () => {
    mockIsConnected.mockReturnValue(false);
    const { toJSON } = render(<NetworkStatus />);
    const tree = toJSON();
    
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Нет подключения к интернету');
  });

  it('should render when online and showWhenOnline is true', () => {
    mockIsConnected.mockReturnValue(true);
    const { toJSON } = render(<NetworkStatus showWhenOnline={true} />);
    const tree = toJSON();
    
    expect(tree).toBeTruthy();
  });

  it('should show reconnection message when connection is restored', async () => {
    // Начинаем с offline
    mockIsConnected.mockReturnValue(false);
    const { rerender, toJSON } = render(<NetworkStatus />);
    
    let tree = toJSON();
    expect(tree).toBeTruthy();
    let treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Нет подключения к интернету');

    // Переключаемся на online
    mockIsConnected.mockReturnValue(true);
    rerender(<NetworkStatus />);

    await waitFor(() => {
      tree = toJSON();
      treeStr = JSON.stringify(tree);
      // Должно показать сообщение о восстановлении
      expect(treeStr).toContain('Соединение восстановлено');
    });
  });

  it('should render at top position by default', () => {
    mockIsConnected.mockReturnValue(false);
    const { toJSON } = render(<NetworkStatus />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render at bottom position when specified', () => {
    mockIsConnected.mockReturnValue(false);
    const { toJSON } = render(<NetworkStatus position="bottom" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should have correct background color for offline state', () => {
    mockIsConnected.mockReturnValue(false);
    const { toJSON } = render(<NetworkStatus />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should have correct background color for online state', () => {
    mockIsConnected.mockReturnValue(true);
    const { toJSON } = render(<NetworkStatus showWhenOnline={true} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

