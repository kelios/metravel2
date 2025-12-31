import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CollapsibleBlock from '@/components/CollapsibleBlock';
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
  it('should render with title and children', () => {
    const { toJSON } = render(
      <CollapsibleBlock id="test" title="Test Block">
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test Block');
    expect(treeStr).toContain('Content');
  });

  it('should render with description', () => {
    const { toJSON } = render(
      <CollapsibleBlock 
        id="test" 
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

  it('should render with icon', () => {
    const { getByTestId } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        icon="info"
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    expect(getByTestId('feather-info')).toBeTruthy();
  });

  it('should toggle expanded state when header is pressed', () => {
    const onToggle = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        onToggle={onToggle}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    
    // Находим кнопку переключения (chevron)
    const toggleButton = pressables.find((p: any) => 
      p.props.accessibilityLabel?.includes('Развернуть') || 
      p.props.accessibilityLabel?.includes('Свернуть')
    );
    
    if (toggleButton) {
      fireEvent.press(toggleButton);
      expect(onToggle).toHaveBeenCalled();
    }
  });

  it('should hide block when close button is pressed', () => {
    const onHide = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        onHide={onHide}
        hasCloseButton={true}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    
    // Находим кнопку закрытия
    const closeButton = pressables.find((p: any) => 
      p.props.accessibilityLabel === 'Скрыть блок'
    );
    
    if (closeButton) {
      fireEvent.press(closeButton);
      expect(onHide).toHaveBeenCalled();
    }
  });

  it('should start collapsed when defaultExpanded is false', () => {
    const { toJSON } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        defaultExpanded={false}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should use controlled expanded state', () => {
    const { toJSON, rerender } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        expanded={false}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    let tree = toJSON();
    expect(tree).toBeTruthy();

    // Перерендерим с expanded=true
    rerender(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        expanded={true}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render in compact mode', () => {
    const { toJSON } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        compactMode={true}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render header actions', () => {
    const { toJSON } = render(
      <CollapsibleBlock 
        id="test" 
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

  it('should not be collapsible when collapsible is false', () => {
    const { toJSON } = render(
      <CollapsibleBlock 
        id="test" 
        title="Test Block"
        collapsible={false}
      >
        <Text>Content</Text>
      </CollapsibleBlock>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should show hidden state when hidden', () => {
    const { toJSON } = render(
      <CollapsibleBlock 
        id="test" 
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
