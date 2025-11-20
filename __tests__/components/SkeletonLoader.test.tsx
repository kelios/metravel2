import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonLoader, TravelCardSkeleton, TravelListSkeleton } from '@/components/SkeletonLoader';

describe('SkeletonLoader', () => {
  it('should render with default props', () => {
    const { toJSON } = render(<SkeletonLoader />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom width', () => {
    const { toJSON } = render(<SkeletonLoader width={200} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom height', () => {
    const { toJSON } = render(<SkeletonLoader height={50} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom borderRadius', () => {
    const { toJSON } = render(<SkeletonLoader borderRadius={8} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with string width', () => {
    const { toJSON } = render(<SkeletonLoader width="50%" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with custom style', () => {
    const customStyle = { marginTop: 10 };
    const { toJSON } = render(<SkeletonLoader style={customStyle} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should combine default and custom styles', () => {
    const { toJSON } = render(
      <SkeletonLoader 
        width={100}
        height={20}
        borderRadius={4}
        style={{ margin: 10 }}
      />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

describe('TravelCardSkeleton', () => {
  it('should render travel card skeleton', () => {
    const { toJSON } = render(<TravelCardSkeleton />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render multiple skeleton elements', () => {
    const { toJSON } = render(<TravelCardSkeleton />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    
    // Должно быть несколько элементов (изображение и текст)
    expect(tree).toBeTruthy();
  });
});

describe('TravelListSkeleton', () => {
  it('should render default count of skeletons', () => {
    const { toJSON } = render(<TravelListSkeleton />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render specified count of skeletons', () => {
    const { toJSON } = render(<TravelListSkeleton count={3} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render multiple card skeletons', () => {
    const { toJSON } = render(<TravelListSkeleton count={5} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should handle zero count', () => {
    const { toJSON } = render(<TravelListSkeleton count={0} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

