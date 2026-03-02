import useTravelDetailsDefault, { useTravelDetails } from '../../hooks/travel-details'

describe('hooks/travel-details export interop', () => {
  it('exports useTravelDetails as a function', () => {
    expect(typeof useTravelDetails).toBe('function')
  })

  it('keeps default export alias for mixed named/default chunk interop', () => {
    expect(useTravelDetailsDefault).toBe(useTravelDetails)
  })
})
