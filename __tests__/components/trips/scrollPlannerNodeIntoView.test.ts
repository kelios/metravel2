import { scrollPlannerNodeIntoView } from '@/components/trips/planning/scrollPlannerNodeIntoView'

describe('scrollPlannerNodeIntoView', () => {
  it('calls scrollIntoView on a node that supports it', () => {
    const scrollIntoView = jest.fn()
    scrollPlannerNodeIntoView({ scrollIntoView }, { block: 'start', behavior: 'smooth' })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
  })

  it('is a no-op when the node cannot scroll', () => {
    expect(() => {
      scrollPlannerNodeIntoView(null, { block: 'start' })
      scrollPlannerNodeIntoView({}, { block: 'nearest' })
    }).not.toThrow()
  })
})
