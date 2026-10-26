import { act, renderHook, waitFor } from '@testing-library/react-native'

const IN_PROGRESS_RESULT = {
  success: false,
  error: 'A payment is already in progress',
}
const DECLINED_RESULT = { success: false, error: 'Declined' }

const mockInstances: object[] = []
const mockPresentations: Array<(result: any) => void> = []

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => {
      // Mirrors the per-instance in-progress guard of the native handlers.
      let inFlight = false
      const instance = {
        payServiceStatus: () =>
          Promise.resolve({ isSupported: true, hasActiveCard: true }),
        isPaymentInProgress: () => inFlight,
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

const settlePresentations = (result: any = { success: true }) =>
  mockPresentations.splice(0).forEach((settle) => settle(result))

describe('shared PaymentHandler instance', () => {
  const directRequest = createPaymentRequest({ amount: 10, label: 'Direct' })

  const renderCheckoutWithItem = () => {
    // Every rendered value, so a brief `isProcessing: true` is caught too.
    const isProcessingHistory: boolean[] = []
    const rendered = renderHook(() => {
      const checkout = usePaymentCheckout({})
      isProcessingHistory.push(checkout.isProcessing)
      return checkout
    })
    act(() => {
      rendered.result.current.addItem('Order', 5)
    })
    return { ...rendered, isProcessingHistory }
  }

  // Leaves the hook with a declined result and clears its render history, so
  // tests see only the renders that come after.
  const declinePayment = async (
    checkout: ReturnType<typeof renderCheckoutWithItem>
  ) => {
    await act(async () => {
      const payment = checkout.result.current.startPayment()
      settlePresentations(DECLINED_RESULT)
      await payment
    })
    expect(checkout.result.current.result).toEqual(DECLINED_RESULT)
    checkout.isProcessingHistory.length = 0
  }

  afterEach(() => settlePresentations())

  it('uses one native handler for the hook and HybridPaymentHandler', async () => {
    const { result } = renderHook(() => usePaymentCheckout({}))
    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })

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

  it('leaves the hook state alone when a direct payment is in flight', async () => {
    const checkout = renderCheckoutWithItem()
    await declinePayment(checkout)
    const { result, isProcessingHistory } = checkout
    const previousResult = result.current.result
    const previousError = result.current.error

    const directPayment = HybridPaymentHandler.startPayment(directRequest)
    let hookResult: any
    await act(async () => {
      hookResult = await result.current.startPayment()
    })

    expect(mockPresentations).toHaveLength(1)
    expect(hookResult).toEqual(IN_PROGRESS_RESULT)
    expect(result.current.result).toBe(previousResult)
    expect(result.current.error).toBe(previousError)
    expect(isProcessingHistory).not.toContain(true)

    settlePresentations()
    await expect(directPayment).resolves.toEqual({ success: true })
  })

  it('leaves the hook state alone when another hook payment is in flight', async () => {
    const first = renderCheckoutWithItem()
    const second = renderCheckoutWithItem()
    await declinePayment(second)
    const previousResult = second.result.current.result
    const previousError = second.result.current.error

    let firstPayment!: Promise<any>
    act(() => {
      firstPayment = first.result.current.startPayment()
    })
    let secondResult: any
    await act(async () => {
      secondResult = await second.result.current.startPayment()
    })

    expect(mockPresentations).toHaveLength(1)
    expect(secondResult).toEqual(IN_PROGRESS_RESULT)
    expect(second.result.current.result).toBe(previousResult)
    expect(second.result.current.error).toBe(previousError)
    expect(second.isProcessingHistory).not.toContain(true)
    expect(first.result.current.isProcessing).toBe(true)

    await act(async () => {
      settlePresentations()
      await firstPayment
    })

    await expect(firstPayment).resolves.toEqual({ success: true })
    expect(first.result.current.result).toEqual({ success: true })
  })
})
