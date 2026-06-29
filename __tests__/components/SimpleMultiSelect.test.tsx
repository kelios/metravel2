import { render, fireEvent, waitFor } from '@testing-library/react-native'
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect'

describe('SimpleMultiSelect', () => {
  const dataNumericIds = [
    { id: 1, name: 'Арка' },
    { id: 2, name: 'Аэропорт' },
  ]

  const dataStringIds = [
    { id: '1', name: 'Арка' },
    { id: '2', name: 'Аэропорт' },
  ]

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
