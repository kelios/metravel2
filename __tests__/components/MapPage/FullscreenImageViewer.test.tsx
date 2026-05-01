import React from 'react';
import { Platform } from 'react-native';

const renderer = require('react-test-renderer');

jest.mock('react-dom', () => ({
  createPortal: jest.fn((node: any) => node),
}));

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    return React.createElement('mock-image-card-media', props);
  },
}));

jest.mock('@/utils/imageOptimization', () => ({
  optimizeImageUrl: (url: string) => url,
}));

const FullscreenImageViewer = require('@/components/MapPage/Map/PlacePopupCard/FullscreenImageViewer').default;
const mockCreatePortal = require('react-dom').createPortal;

const mockColors = {
  textOnDark: '#fff',
};

describe('FullscreenImageViewer', () => {
  const originalPlatform = Platform.OS;
  const originalWindowDimensions = require('react-native').useWindowDimensions;
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    (Platform as any).OS = 'web';
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }));
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockCreatePortal.mockClear();
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    require('react-native').useWindowDimensions = originalWindowDimensions;
    nowSpy.mockRestore();
  });

  it('ignores the first backdrop click after opening so mobile synthetic click does not close it immediately', () => {
    const onClose = jest.fn();
    let tree: any;

    renderer.act(() => {
      tree = renderer.create(
        <FullscreenImageViewer
          imageUrl="https://example.com/photo.jpg"
          alt="Test point"
          visible
          onClose={onClose}
          colors={mockColors as any}
        />
      );
    });

    const overlay = tree.root.findAll((node: any) => node.type === 'div' && node.props?.style?.position === 'fixed')[0];
    expect(overlay).toBeTruthy();
    expect(mockCreatePortal).toHaveBeenCalledWith(expect.anything(), document.body);

    const event = { target: null as any, currentTarget: null as any };
    event.target = overlay;
    event.currentTarget = overlay;

    renderer.act(() => {
      overlay.props.onClick(event);
    });
    expect(onClose).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(1501);
    renderer.act(() => {
      overlay.props.onClick(event);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
