import { render } from '@testing-library/react-native';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { StyleSheet } from 'react-native';

describe('SkeletonLoader', () => {
  it('should render with default props', () => {
    const { toJSON } = render(<SkeletonLoader />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should apply width/height/borderRadius and expose testID', () => {
    const { getByTestId } = render(
      <SkeletonLoader testID="skeleton" width={123} height={45} borderRadius={7} />
    );

    const node = getByTestId('skeleton');
    const flattened = StyleSheet.flatten(node.props.style);

    expect(flattened.width).toBe(123);
    expect(flattened.height).toBe(45);
    expect(flattened.borderRadius).toBe(7);
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
