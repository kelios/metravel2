import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { getThemedColors } from '@/constants/designSystem'
import PlacesCountryMenu from '@/screens/tabs/PlacesCountryMenu'
import { createStyles } from '@/screens/tabs/PlacesScreen.styles'

jest.mock('@/ui/paper', () => {
  const React = require('react')
  const { View, Pressable, Text } = require('react-native')
  const Menu = ({ children, anchor, visible }: any) => <View>{anchor}{visible ? children : null}</View>
  Menu.Item = ({ title, onPress }: any) => <Pressable accessibilityRole="button" onPress={onPress}><Text>{title}</Text></Pressable>
  return { Menu }
})

const colors = getThemedColors(false)

it.each([false, true])('country anchor remains usable during pending scope (compact=%s)', async (compact) => {
  const onShow = jest.fn()
  const result = await render(<PlacesCountryMenu compact={compact} visible={false} selectedCountry={null} countryFacets={[]} catalogTotal={0} showLoadedCounts={false} scopeStatus="loading" onRetry={jest.fn()} onShow={onShow} onDismiss={jest.fn()} onSelect={jest.fn()} styles={createStyles(colors, compact, !compact)} colors={colors} />)
  const anchor = result.getByTestId('places-country-select')
  expect(anchor.props.disabled).not.toBe(true)
  expect(StyleSheet.flatten(anchor.props.style).minHeight).toBeGreaterThanOrEqual(44)
  await fireEvent.press(anchor)
  expect(onShow).toHaveBeenCalledTimes(1)
  expect(result.queryByText(/\(0\)/)).toBeNull()
})

it.each([false, true])('country error exposes an actual labelled retry without inventing counts (compact=%s)', async (compact) => {
  const onRetry = jest.fn()
  const result = await render(<PlacesCountryMenu compact={compact} visible selectedCountry={null} countryFacets={[]} catalogTotal={0} showLoadedCounts={false} scopeStatus="error" onRetry={onRetry} onShow={jest.fn()} onDismiss={jest.fn()} onSelect={jest.fn()} styles={createStyles(colors, compact, !compact)} colors={colors} />)
  expect(result.getByText('Не удалось загрузить фильтры')).toBeTruthy()
  expect(result.getByText('Повторить')).toBeTruthy()
  expect(result.queryByText(/\(0\)/)).toBeNull()
  await fireEvent.press(result.getByTestId('places-scope-retry'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

it('shows an honest zero only after a successful empty full-scope response', async () => {
  const result = await render(<PlacesCountryMenu visible selectedCountry={null} countryFacets={[]} catalogTotal={0} showLoadedCounts scopeStatus="ready" onRetry={jest.fn()} onShow={jest.fn()} onDismiss={jest.fn()} onSelect={jest.fn()} styles={createStyles(colors, false, true)} colors={colors} />)
  expect(result.getAllByText('Все страны (0)')).toHaveLength(2)
  expect(result.queryByTestId('places-scope-error')).toBeNull()
})
