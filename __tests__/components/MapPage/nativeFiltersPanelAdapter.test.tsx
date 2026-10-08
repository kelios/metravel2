import React, { useMemo, useState } from 'react'
import { fireEvent, render, within } from '@testing-library/react-native'
import { TextInput, View, Pressable, Text } from 'react-native'
import { NativeMapSheetFooterContext, NativeMapSheetFlowContext, MapMobileSheetHeader, renderMobileFiltersPanel } from '@/components/MapPage/MapMobile/nativeFiltersPanelAdapter.native'
import { renderMobileFiltersPanel as renderWebPanel, MapMobileSheetHeader as WebHeader } from '@/components/MapPage/MapMobile/nativeFiltersPanelAdapter.tsx'

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { ScrollView } = require('react-native')
  return { BottomSheetScrollView: ({ children, ...props }: any) => React.createElement(ScrollView, props, children) }
})

const reset = jest.fn()
const Panel = React.memo(function Panel({ ScrollComponent, renderFooter }: any) {
  const [value, setValue] = useState('category')
  const footer = <Pressable testID="reset" onPress={reset}><Text>{value}</Text></Pressable>
  return <View>
    <ScrollComponent testID="body-scroll"><TextInput testID="input" value={value} onChangeText={setValue} /></ScrollComponent>
    {renderFooter(footer)}
  </View>
})

function Harness({ flow }: { flow: boolean }) {
  const [header, publishHeader] = useState<React.ReactNode>(null)
  const [footer, publishFooter] = useState<React.ReactNode>(null)
  const context = useMemo(() => ({ publishHeader, publishFooter, measureHeader: jest.fn(), measureFooter: jest.fn() }), [])
  // Production receives the header from the sheet's unchanged children prop.
  const headerNode = useMemo(() => <MapMobileSheetHeader testID="sheet-header"><Text>Sheet header</Text></MapMobileSheetHeader>, [])
  return <NativeMapSheetFooterContext.Provider value={context}>
    <NativeMapSheetFlowContext.Provider value={{ header, footer, flow }}>
    <View testID="fixed-header">{headerNode}</View>
    {renderMobileFiltersPanel(Panel)}
    <View testID="fixed-footer">{flow ? null : footer}</View>
    </NativeMapSheetFlowContext.Provider>
  </NativeMapSheetFooterContext.Provider>
}

describe('native map filter composition', () => {
  it('keeps the same input and one scroll when measured chrome moves into flow, preserving callbacks', () => {
    reset.mockClear()
    const screen = render(<Harness flow={false} />)
    const input = screen.getByTestId('input')
    fireEvent.changeText(input, 'unchanged after snap')
    expect(screen.getByText('unchanged after snap')).toBeTruthy()
    expect(screen.getByTestId('fixed-footer').findByProps({ testID: 'reset' })).toBeTruthy()
    expect(within(screen.getByTestId('fixed-header')).getByTestId('sheet-header')).toBeTruthy()
    screen.rerender(<Harness flow={true} />)
    expect(screen.getByTestId('input')).toBe(input)
    expect(screen.getByTestId('input').props.value).toBe('unchanged after snap')
    expect(screen.getAllByTestId('body-scroll')).toHaveLength(1)
    expect(screen.getAllByTestId('reset')).toHaveLength(1)
    expect(screen.getAllByTestId('sheet-header')).toHaveLength(1)
    expect(within(screen.getByTestId('body-scroll')).getByTestId('sheet-header')).toBeTruthy()
    expect(within(screen.getByTestId('fixed-header')).queryByTestId('sheet-header')).toBeNull()
    expect(screen.getByTestId('map-sheet-flow-footer').findByProps({ testID: 'reset' })).toBeTruthy()
    fireEvent.press(screen.getByTestId('reset'))
    expect(reset).toHaveBeenCalledTimes(1)
    screen.rerender(<Harness flow={false} />)
    expect(screen.getByTestId('input')).toBe(input)
    expect(screen.getByTestId('input').props.value).toBe('unchanged after snap')
    expect(screen.queryByTestId('map-sheet-flow-footer')).toBeNull()
    expect(within(screen.getByTestId('fixed-header')).getByTestId('sheet-header')).toBeTruthy()
  })

  it('keeps web panel props and native host structure unchanged', () => {
    const panel = renderWebPanel(Panel)
    expect(panel.type).toBe(Panel)
    expect(panel.props).toEqual({ hideTopControls: true })
    expect(WebHeader).toBe(View)
  })
})
