import React from 'react'
import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect'

describe('SimpleMultiSelect', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
  })
  const dataNumericIds = [
    { id: 1, name: 'Арка' },
    { id: 2, name: 'Аэропорт' },
  ]

  const dataStringIds = [
    { id: '1', name: 'Арка' },
    { id: '2', name: 'Аэропорт' },
  ]

  it('uses ScrollView on web so category lists cannot trigger the FlashList commitLayout loop', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const screen = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={jest.fn()}
        labelField="name"
        valueField="id"
      />
    )

    expect(mockFlashListProps).toHaveLength(0)
    expect(getOnlyHost(screen.container, node => node.type === "RCTScrollView")).toBeTruthy()

    await fireEvent.press(screen.getByLabelText('Открыть выбор'))

    expect(mockFlashListProps).toHaveLength(0)
    expect(screen.getByTestId('simple-multiselect.web-options-list')).toBeTruthy()
  })

  it('uses 48dp Android targets and checkbox semantics in the native branch', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    const screen = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={jest.fn()}
        labelField="name"
        valueField="id"
      />
    )

    const trigger = screen.getByTestId('simple-multiselect.trigger')
    expect(StyleSheet.flatten(trigger.props.style).minHeight).toBe(48)
    await fireEvent.press(screen.getByLabelText('Открыть выбор'))

    const item = screen.getByTestId('simple-multiselect.item.1')
    expect(mockFlashListProps).not.toHaveLength(0)
    expect(StyleSheet.flatten(item.props.style).minHeight).toBe(48)
    expect(item.props.accessibilityRole).toBe('checkbox')
    expect(item.props.accessibilityState).toEqual({ checked: true })
  })

  it('opens from the selected chip body without invoking its remove control', async () => {
    const onChange = jest.fn()
    const screen = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    await fireEvent.press(screen.getByTestId('simple-multiselect.selected-chip.1'))

    expect(screen.getByText('Выбрано: 1')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps selected chips visually compact with a full-size remove target', async () => {
    const screen = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={jest.fn()}
        labelField="name"
        valueField="id"
      />
    )

    const visualChip = StyleSheet.flatten(
      screen.getByTestId('simple-multiselect.selected-chip-visual.1').props.style,
    )
    const removeControl = StyleSheet.flatten(
      screen.getByTestId('simple-multiselect.selected-chip-remove.1').props.style,
    )
    const removeVisual = StyleSheet.flatten(
      screen.getByTestId('simple-multiselect.selected-chip-remove-visual.1').props.style,
    )
    const expectedControlSize = Platform.OS === 'android' ? 48 : 44

    expect(visualChip.height).toBe(32)
    expect(visualChip.borderRadius).toBe(12)
    expect(removeVisual.width).toBe(expectedControlSize)
    expect(removeControl.width).toBe(expectedControlSize)
    expect(removeControl.height).toBe(expectedControlSize)
  })

  it('does not remove a selected value when the field is disabled', async () => {
    const onChange = jest.fn()
    const screen = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={onChange}
        labelField="name"
        valueField="id"
        disabled
      />
    )

    await fireEvent.press(screen.getByTestId('simple-multiselect.selected-chip-remove.1'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onOpen once when the closed picker opens, not on a second press', async () => {
    const onOpen = jest.fn()
    const screen = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={jest.fn()}
        labelField="name"
        valueField="id"
        onOpen={onOpen}
      />,
    )

    await fireEvent.press(screen.getByTestId('simple-multiselect.open-button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    await fireEvent.press(screen.getByTestId('simple-multiselect.open-button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('opens from the remaining selected field area and the explicit chevron control', async () => {
    const props = {
      data: dataNumericIds,
      value: [1],
      onChange: jest.fn(),
      labelField: 'name',
      valueField: 'id',
    }
    let screen = await render(<SimpleMultiSelect {...props} />)

    await fireEvent.press(screen.getByTestId('simple-multiselect.selected-open-area'))
    expect(screen.getByText('Выбрано: 1')).toBeTruthy()

    await screen.unmount()
    screen = await render(<SimpleMultiSelect {...props} />)
    await fireEvent.press(screen.getByTestId('simple-multiselect.open-button'))
    expect(screen.getByText('Выбрано: 1')).toBeTruthy()
  })

  it('treats string value as selected when item id is number', async () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId } = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1']}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    await fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    // Clicking on the already-selected item should remove it
    await fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('treats number value as selected when item id is string', async () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId } = await render(
      <SimpleMultiSelect
        data={dataStringIds}
        value={[1]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    await fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    await fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds item without creating duplicates when types differ', async () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId, rerender } = await render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1']}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    await fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    // Select second item; should append 2
    await fireEvent.press(getByTestId('simple-multiselect.item.2'))

    expect(onChange).toHaveBeenCalledWith(['1', 2])

    // Re-render with mixed value and re-select first item; should remove it (not add duplicate)
    await rerender(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1', 2]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    await fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 2')).toBeTruthy()
    await fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([2])
  })

  describe('allowCreate', () => {
    it('does not show the create row without allowCreate (default off)', async () => {
      const { getByLabelText, getByPlaceholderText, queryByText } = await render(
        <SimpleMultiSelect
          data={dataStringIds}
          value={[]}
          onChange={jest.fn()}
          labelField="name"
          valueField="id"
        />
      )

      await fireEvent.press(getByLabelText('Открыть выбор'))
      await fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Новая категория')

      expect(queryByText(/Добавить «Новая категория»/)).toBeNull()
    })

    it('creates a category and auto-selects the returned id', async () => {
      const onChange = jest.fn()
      const onCreateItem = jest.fn().mockResolvedValue('99')

      const { getByLabelText, getByPlaceholderText, getByText } = await render(
        <SimpleMultiSelect
          data={dataStringIds}
          value={['1']}
          onChange={onChange}
          labelField="name"
          valueField="id"
          allowCreate
          onCreateItem={onCreateItem}
          createLabel="Добавить категорию"
        />
      )

      await fireEvent.press(getByLabelText('Открыть выбор'))
      await fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Дворик')

      await fireEvent.press(getByText(/Добавить категорию «Дворик»/))

      await waitFor(() => expect(onCreateItem).toHaveBeenCalledWith('Дворик'))
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(['1', '99']))
    })

    it('hides the create row when an exact match already exists', async () => {
      const { getByLabelText, getByPlaceholderText, queryByText } = await render(
        <SimpleMultiSelect
          data={dataStringIds}
          value={[]}
          onChange={jest.fn()}
          labelField="name"
          valueField="id"
          allowCreate
          onCreateItem={jest.fn()}
        />
      )

      await fireEvent.press(getByLabelText('Открыть выбор'))
      await fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Арка')

      expect(queryByText(/Добавить «Арка»/)).toBeNull()
    })

    it('surfaces an error when creation fails', async () => {
      const onCreateItem = jest.fn().mockRejectedValue(new Error('Сервер недоступен'))

      const { getByLabelText, getByPlaceholderText, getByText } = await render(
        <SimpleMultiSelect
          data={dataStringIds}
          value={[]}
          onChange={jest.fn()}
          labelField="name"
          valueField="id"
          allowCreate
          onCreateItem={onCreateItem}
        />
      )

      await fireEvent.press(getByLabelText('Открыть выбор'))
      await fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Дворик')
      await fireEvent.press(getByText(/Добавить «Дворик»/))

      await waitFor(() => expect(getByText('Сервер недоступен')).toBeTruthy())
    })
  })
})

// Observe whether the native virtualization boundary is used, without replacing it.
const flashListModule = require('@shopify/flash-list')
const originalFlashList = flashListModule.FlashList
const mockFlashListProps: Record<string, unknown>[] = []
beforeAll(() => {
  flashListModule.FlashList = React.forwardRef((props: any, ref: any) => {
    mockFlashListProps.push(props)
    return React.createElement(originalFlashList, { ...props, ref })
  })
})
afterAll(() => { flashListModule.FlashList = originalFlashList })
beforeEach(() => { mockFlashListProps.length = 0 })
