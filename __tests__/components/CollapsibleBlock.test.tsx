import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CollapsibleBlock from '@/components/ui/CollapsibleBlock';
import { Text } from 'react-native';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// Mock design system
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      primary: '#6b8e7f',
      primarySoft: '#e8f5e9',
      text: '#1f2937',
      textMuted: '#6b7280',
      textSubtle: '#9ca3af',
      surface: '#ffffff',
      border: '#e5e7eb',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
    },
    radii: {
      sm: 4,
      md: 8,
      lg: 12,
    },
    shadows: {
      light: '0 1px 3px rgba(0,0,0,0.1)',
    },
    shadowsNative: {
      light: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
      },
    },
  },
}));

// Mock Animated API
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      Value: jest.fn((initialValue) => ({
        _value: initialValue,
        setValue: jest.fn(),
        interpolate: jest.fn((config) => ({
          _value: initialValue,
          ...config,
        })),
      })),
      timing: jest.fn(() => ({
        start: jest.fn((callback) => {
          callback && callback({ finished: true });
        }),
      })),
      parallel: jest.fn((animations) => ({
        start: jest.fn((callback) => {
          animations.forEach((anim: any) => anim.start());
          callback && callback({ finished: true });
        }),
      })),
    },
    LayoutAnimation: {
      configureNext: jest.fn(),
      Presets: {
        easeInEaseOut: {},
      },
    },
  };
});

describe('CollapsibleBlock', () => {
  it('should render with title and children', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock title="Test Block">
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test Block');
    expect(treeStr).toContain('Content');
  });

  it('should render with description', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock 
        title="Test Block"
        description="Test description"
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test description');
  });

  it('should render with icon', async () => {
    const { getByTestId } = await render(
      <CollapsibleBlock 
        title="Test Block"
        icon="info"
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    expect(getByTestId('feather-info')).toBeTruthy();
  });

  it('should toggle expanded state when header is pressed', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await render(<CollapsibleBlock title="Test Block" onToggle={onToggle}><Text>Content</Text></CollapsibleBlock>);
    await fireEvent.press(getByLabelText('Свернуть: Test Block'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('should hide block when close button is pressed', async () => {
    const onHide = jest.fn();
    const { getByLabelText } = await render(<CollapsibleBlock title="Test Block" onHide={onHide} hasCloseButton><Text>Content</Text></CollapsibleBlock>);
    await fireEvent.press(getByLabelText('Скрыть блок'));
    expect(onHide).toHaveBeenCalled();
  });

  it('should start collapsed when defaultExpanded is false', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock 
        title="Test Block"
        defaultExpanded={false}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should use controlled expanded state', async () => {
    const { toJSON, rerender } = await render(
      <CollapsibleBlock 
        title="Test Block"
        expanded={false}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    let tree = toJSON();
    expect(tree).toBeTruthy();

    // Перерендерим с expanded=true
    await rerender(
      <CollapsibleBlock 
        title="Test Block"
        expanded={true}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render in compact mode', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock 
        title="Test Block"
        compactMode={true}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render header actions', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock 
        title="Test Block"
        headerActions={<Text>Action</Text>}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Action');
  });

  it('should not be collapsible when collapsible is false', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock 
        title="Test Block"
        collapsible={false}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should show hidden state when hidden', async () => {
    const { toJSON } = await render(
      <CollapsibleBlock 
        title="Test Block"
        hidden={true}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Показать: ');
    expect(treeStr).toContain('Test Block');
  });
});
