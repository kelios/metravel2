import React from 'react';
import renderer, { ReactTestInstance } from 'react-test-renderer';
import SelectComponent from '@/components/SelectComponent';

const options = [
  { value: '1', label: 'Belarus' },
  { value: '2', label: 'Poland' },
];

const renderComponent = (props = {}) =>
  renderer.create(
    <SelectComponent
      label="Country"
      options={options}
      value=""
      placeholder="Select option"
      {...props}
    />
  );

describe('SelectComponent (web)', () => {
  it('renders label and placeholder', () => {
    const tree = renderComponent().root;
    const labelNode = tree.find(
      (node: ReactTestInstance) => node.type === 'label'
    );
    expect(labelNode.children).toContain('Country');

    const optionNodes = tree.findAll((node) => node.type === 'option');
    expect(optionNodes[0].children).toContain('Select option');
  });

  it('renders provided options', () => {
    const tree = renderComponent().root;
    const optionNodes = tree.findAll((node) => node.type === 'option');
    const labels = optionNodes.map((node) => node.children.join(''));
    expect(labels).toEqual(['Select option', 'Belarus', 'Poland']);
  });

  it('calls onChange when selection changes', () => {
    const onChange = jest.fn();
    const instance = renderComponent({ value: '1', onChange }).root;
    const select = instance.find((node) => node.type === 'select');

    select.props.onChange({ target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('honors controlled value prop', () => {
    const tree = renderComponent({ value: '2' }).root;
    const select = tree.find((node) => node.type === 'select');
    expect(select.props.value).toBe('2');
  });
});

