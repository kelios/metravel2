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

  it('uses 48dp Android targets and checkbox semantics in the native branch', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    const screen = render(
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
    fireEvent.press(screen.getByLabelText('Открыть выбор'))

    const item = screen.getByTestId('simple-multiselect.item.1')
    expect(StyleSheet.flatten(item.props.style).minHeight).toBe(48)
    expect(item.props.accessibilityRole).toBe('checkbox')
    expect(item.props.accessibilityState).toEqual({ checked: true })
  })

  it('opens from the selected chip body without invoking its remove control', () => {
    const onChange = jest.fn()
    const screen = render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={[1]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(screen.getByTestId('simple-multiselect.selected-chip.1'))

    expect(screen.getByText('Выбрано: 1')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens from the remaining selected field area and the explicit chevron control', () => {
    const props = {
      data: dataNumericIds,
      value: [1],
      onChange: jest.fn(),
      labelField: 'name',
      valueField: 'id',
    }
    let screen = render(<SimpleMultiSelect {...props} />)

    fireEvent.press(screen.getByTestId('simple-multiselect.selected-open-area'))
    expect(screen.getByText('Выбрано: 1')).toBeTruthy()

    screen.unmount()
    screen = render(<SimpleMultiSelect {...props} />)
    fireEvent.press(screen.getByTestId('simple-multiselect.open-button'))
    expect(screen.getByText('Выбрано: 1')).toBeTruthy()
  })

  it('treats string value as selected when item id is number', () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId } = render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1']}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    // Clicking on the already-selected item should remove it
    fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('treats number value as selected when item id is string', () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId } = render(
      <SimpleMultiSelect
        data={dataStringIds}
        value={[1]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds item without creating duplicates when types differ', () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId, rerender } = render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1']}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    // Select second item; should append 2
    fireEvent.press(getByTestId('simple-multiselect.item.2'))

    expect(onChange).toHaveBeenCalledWith(['1', 2])

    // Re-render with mixed value and re-select first item; should remove it (not add duplicate)
    rerender(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1', 2]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 2')).toBeTruthy()
    fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([2])
  })

  describe('allowCreate', () => {
    it('does not show the create row without allowCreate (default off)', () => {
      const { getByLabelText, getByPlaceholderText, queryByText } = render(
        <SimpleMultiSelect
          data={dataStringIds}
          value={[]}
          onChange={jest.fn()}
          labelField="name"
          valueField="id"
        />
      )

      fireEvent.press(getByLabelText('Открыть выбор'))
      fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Новая категория')

      expect(queryByText(/Добавить «Новая категория»/)).toBeNull()
    })

    it('creates a category and auto-selects the returned id', async () => {
      const onChange = jest.fn()
      const onCreateItem = jest.fn().mockResolvedValue('99')

      const { getByLabelText, getByPlaceholderText, getByText } = render(
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

      fireEvent.press(getByLabelText('Открыть выбор'))
      fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Дворик')

      fireEvent.press(getByText(/Добавить категорию «Дворик»/))

      await waitFor(() => expect(onCreateItem).toHaveBeenCalledWith('Дворик'))
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(['1', '99']))
    })

    it('hides the create row when an exact match already exists', () => {
      const { getByLabelText, getByPlaceholderText, queryByText } = render(
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

      fireEvent.press(getByLabelText('Открыть выбор'))
      fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Арка')

      expect(queryByText(/Добавить «Арка»/)).toBeNull()
    })

    it('surfaces an error when creation fails', async () => {
      const onCreateItem = jest.fn().mockRejectedValue(new Error('Сервер недоступен'))

      const { getByLabelText, getByPlaceholderText, getByText } = render(
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

      fireEvent.press(getByLabelText('Открыть выбор'))
      fireEvent.changeText(getByPlaceholderText('Поиск...'), 'Дворик')
      fireEvent.press(getByText(/Добавить «Дворик»/))

      await waitFor(() => expect(getByText('Сервер недоступен')).toBeTruthy())
    })
  })
})
