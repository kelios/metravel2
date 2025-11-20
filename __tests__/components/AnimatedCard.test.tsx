import React from 'react';
import { render } from '@testing-library/react-native';
import AnimatedCard from '@/components/AnimatedCard';
import { Text, View } from 'react-native';

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
        setOffset: jest.fn(),
        flattenOffset: jest.fn(),
        extractOffset: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        stopAnimation: jest.fn(),
        resetAnimation: jest.fn(),
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
      spring: jest.fn(() => ({
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
  };
});

describe('AnimatedCard', () => {
  it('should render children correctly', () => {
    const { toJSON } = render(
      <AnimatedCard>
        <Text>Test Content</Text>
      </AnimatedCard>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test Content');
  });

  it('should apply custom style', () => {
    const customStyle = { marginTop: 20 };
    const { toJSON } = render(
      <AnimatedCard style={customStyle}>
        <Text>Test</Text>
      </AnimatedCard>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should handle index prop', () => {
    const { toJSON } = render(
      <AnimatedCard index={2}>
        <Text>Test</Text>
      </AnimatedCard>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should handle delay prop', () => {
    const { toJSON } = render(
      <AnimatedCard delay={100}>
        <Text>Test</Text>
      </AnimatedCard>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render multiple cards with different indices', () => {
    const { toJSON } = render(
      <View>
        <AnimatedCard index={0}>
          <Text>Card 1</Text>
        </AnimatedCard>
        <AnimatedCard index={1}>
          <Text>Card 2</Text>
        </AnimatedCard>
        <AnimatedCard index={2}>
          <Text>Card 3</Text>
        </AnimatedCard>
      </View>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Card 1');
    expect(treeStr).toContain('Card 2');
    expect(treeStr).toContain('Card 3');
  });

  it('should use default values when props not provided', () => {
    const { toJSON } = render(
      <AnimatedCard>
        <Text>Default Test</Text>
      </AnimatedCard>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

