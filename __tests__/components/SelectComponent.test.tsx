import React from 'react';
import renderer from 'react-test-renderer';
import SelectComponent from '@/components/SelectComponent';
import { Platform } from 'react-native';

const options = [
  { value: '1', label: 'Belarus' },
  { value: '2', label: 'Poland' },
];

const renderComponent = (props = {}) => {
  let tree: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <SelectComponent
        label="Country"
        options={options}
        value=""
        placeholder="Select option"
        {...props}
      />
    );
  });
  return tree!;
};

describe('SelectComponent (web)', () => {
  const originalPlatform = Platform.OS;
  const originalSelect = Platform.select;

  beforeAll(() => {
    Platform.OS = 'web';
    Platform.select = (obj: any) => obj.web ?? obj.default;
  });

  afterAll(() => {
    Platform.OS = originalPlatform;
    Platform.select = originalSelect;
  });

  it('renders label and placeholder', () => {
    const tree = renderComponent().root;
    const labelNode = tree.find((node: any) => node.type === 'label');
    expect(labelNode.children).toContain('Country');

    const optionNodes = tree.findAll((node: any) => node.type === 'option');
    expect(optionNodes[0].children).toContain('Select option');
  });

  it('renders provided options', () => {
    const tree = renderComponent().root;
    const optionNodes = tree.findAll((node: any) => node.type === 'option');
    const labels = optionNodes.map((node: any) => node.children.join(''));
    expect(labels).toEqual(['Select option', 'Belarus', 'Poland']);
  });

  it('calls onChange when selection changes', () => {
    const onChange = jest.fn();
    const instance = renderComponent({ value: '1', onChange }).root;
    const select = instance.find((node: any) => node.type === 'select');

    select.props.onChange({ target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('honors controlled value prop', () => {
    const tree = renderComponent({ value: '2' }).root;
    const select = tree.find((node: any) => node.type === 'select');
    expect(select.props.value).toBe('2');
  });
});
