/**
 * #2239 на native: приложение монтируется уже на сохранённом языке, а не на
 * системном с последующим перемонтированием ключом (двойные стартовые запросы).
 */
import React, { useEffect } from 'react'
import { Text } from 'react-native'
import { act, render, screen } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import i18n from '@/i18n/instance'
import { LocaleProvider } from '@/i18n/LocaleProvider'

const STORAGE_KEY = '@metravel/locale-preference:v1'

describe('LocaleProvider (native) boot with a stored locale (#2239)', () => {
  const mounts: string[] = []
  const Screen = () => {
    useEffect(() => {
      mounts.push(i18n.resolvedLanguage ?? '')
    }, [])
    return <Text>{`screen:${i18n.resolvedLanguage}`}</Text>
  }

  beforeEach(async () => {
    mounts.length = 0
    await AsyncStorage.clear()
    await i18n.changeLanguage('ru')
  })

  afterAll(async () => {
    await i18n.changeLanguage('ru')
  })

  it('mounts the app once, already in the stored language', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))

    render(
      <LocaleProvider>
        <Screen />
      </LocaleProvider>,
    )
    expect(screen.queryByText(/^screen:/)).toBeNull()

    expect(await screen.findByText('screen:pl')).toBeTruthy()
    await act(async () => {})
    expect(mounts).toEqual(['pl'])
  })

  it('mounts once in the active language when nothing is stored', async () => {
    render(
      <LocaleProvider>
        <Screen />
      </LocaleProvider>,
    )

    expect(await screen.findByText('screen:ru')).toBeTruthy()
    await act(async () => {})
    expect(mounts).toEqual(['ru'])
  })
})
