import { act, renderHook } from '@testing-library/react-native'

const IN_PROGRESS_RESULT = {
  success: false,
  error: 'A payment is already in progress',
}

const mockInstances: object[] = []
const mockPresentations: Array<(result: any) => void> = []

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => {
      // Mirrors the per-instance in-progress guard of the native handlers.
      let inFlight = false
      const instance = {
        payServiceStatus: () => ({
          canMakePayments: true,
          canSetupCards: true,
        }),
        startPayment: () => {
          if (inFlight) {
            return Promise.resolve({
              success: false,
              error: 'A payment is already in progress',
            })
          }
          inFlight = true
          return new Promise((resolve) => {
            mockPresentations.push((result) => {
              inFlight = false
              resolve(result)
            })
          })
        },
      }
      mockInstances.push(instance)
      return instance
    },
  },
  getHostComponent: () => 'HostComponent',
}))

// Required after the mock state above exists: importing the package creates
// the handler immediately.
const { HybridPaymentHandler, usePaymentCheckout, createPaymentRequest } =
  require('../index') as typeof import('../index')

const settlePresentations = () =>
  mockPresentations.splice(0).forEach((settle) => settle({ success: true }))

describe('shared PaymentHandler instance', () => {
  const directRequest = createPaymentRequest({ amount: 10, label: 'Direct' })

  const renderCheckoutWithItem = () => {
    const rendered = renderHook(() => usePaymentCheckout({}))
    act(() => {
      rendered.result.current.addItem('Order', 5)
    })
    return rendered
  }

  afterEach(settlePresentations)

  it('uses one native handler for the hook and HybridPaymentHandler', () => {
    renderHook(() => usePaymentCheckout({}))

    expect(mockInstances).toHaveLength(1)
    expect(mockInstances[0]).toBe(HybridPaymentHandler)
  })

  it('rejects a direct call while the hook payment is in flight', async () => {
    const { result } = renderCheckoutWithItem()

    let hookPayment!: Promise<any>
    let directResult: any
    await act(async () => {
      hookPayment = result.current.startPayment()
      directResult = await HybridPaymentHandler.startPayment(directRequest)
    })

    expect(mockPresentations).toHaveLength(1)
    expect(directResult).toEqual(IN_PROGRESS_RESULT)

    await act(async () => {
      settlePresentations()
      await hookPayment
    })

    await expect(hookPayment).resolves.toEqual({ success: true })
  })

  it('records the native in-progress result when a direct payment is in flight', async () => {
    const { result } = renderCheckoutWithItem()

    const directPayment = HybridPaymentHandler.startPayment(directRequest)
    let hookResult: any
    await act(async () => {
      hookResult = await result.current.startPayment()
    })

    expect(mockPresentations).toHaveLength(1)
    expect(hookResult).toEqual(IN_PROGRESS_RESULT)
    expect(result.current.result).toEqual(IN_PROGRESS_RESULT)
    expect(result.current.error?.message).toBe(IN_PROGRESS_RESULT.error)

    settlePresentations()
    await expect(directPayment).resolves.toEqual({ success: true })
  })
})
