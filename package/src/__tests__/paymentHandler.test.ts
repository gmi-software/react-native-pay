import { act, renderHook, waitFor } from '@testing-library/react-native'
import { PAYMENT_IN_PROGRESS_RESULT as IN_PROGRESS_RESULT } from '../paymentHandler'
import type { PaymentSheetSelection, StartPaymentOptions } from '../types'

const DECLINED_RESULT = {
  status: 'failed',
  code: 'PROVIDER_ERROR',
  success: false,
  error: 'Declined',
}

const mockInstances: Array<{ startPayment: jest.Mock }> = []
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
        startPayment: jest.fn(() => {
          if (inFlight) {
            return Promise.resolve({
              status: 'failed',
              code: 'IN_PROGRESS',
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
        }),
      }
      mockInstances.push(instance)
      return instance
    },
  },
  getHostComponent: () => 'HostComponent',
}))

// Required after the mock state above exists.
const {
  HybridPaymentHandler,
  getPaymentHandler,
  usePaymentCheckout,
  createPaymentRequest,
} = require('../index') as typeof import('../index')

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

    expect(HybridPaymentHandler.isPaymentInProgress()).toBe(false)
    expect(mockInstances).toHaveLength(1)
    expect(mockInstances[0]).toBe(getPaymentHandler())
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

describe('request validation', () => {
  const baseRequest = createPaymentRequest({ amount: 10, label: 'Order' })

  // Each request fails normalizePaymentRequest, which the hook runs too.
  const invalidRequests: Array<[string, typeof baseRequest]> = [
    [
      '0.1 + 0.2',
      {
        ...baseRequest,
        paymentItems: [{ label: 'Order', amount: 0.1 + 0.2, type: 'final' }],
      },
    ],
    [
      "'19.999' USD",
      {
        ...baseRequest,
        paymentItems: [{ label: 'Order', amount: '19.999', type: 'final' }],
      },
    ],
    [
      "'1.5' JPY",
      {
        ...baseRequest,
        currencyCode: 'JPY',
        paymentItems: [{ label: 'Order', amount: '1.5', type: 'final' }],
      },
    ],
    ["currency 'usd'", { ...baseRequest, currencyCode: 'usd' }],
    ["country 'USA'", { ...baseRequest, countryCode: 'USA' }],
  ]

  const nativeStartPayment = () => {
    getPaymentHandler()
    return mockInstances[0]!.startPayment
  }

  beforeEach(() => nativeStartPayment().mockClear())

  it.each(invalidRequests)(
    'HybridPaymentHandler resolves %s with CONFIGURATION without calling native',
    async (_, request) => {
      const result = await HybridPaymentHandler.startPayment(request)

      expect(result).toEqual({
        status: 'failed',
        code: 'CONFIGURATION',
        success: false,
        error: expect.any(String),
      })
      expect(nativeStartPayment()).not.toHaveBeenCalled()
    }
  )

  it.each(invalidRequests)(
    'usePaymentCheckout resolves %s with CONFIGURATION without calling native',
    async (_, request) => {
      const { currencyCode, countryCode, paymentItems } = request
      const { result } = renderHook(() =>
        usePaymentCheckout({ currencyCode, countryCode })
      )
      act(() => {
        result.current.addItem('Order', paymentItems[0]!.amount)
      })

      let hookResult: any
      await act(async () => {
        hookResult = await result.current.startPayment()
      })

      // The same shape HybridPaymentHandler resolves with.
      expect(hookResult).toEqual(
        await HybridPaymentHandler.startPayment(request)
      )
      expect(result.current.error).toHaveProperty('code', 'CONFIGURATION')
      expect(nativeStartPayment()).not.toHaveBeenCalled()
    }
  )

  it.each(invalidRequests)(
    'createPaymentRequest throws for %s',
    (_, { currencyCode, countryCode, paymentItems }) => {
      expect(() =>
        createPaymentRequest({
          amount: paymentItems[0]!.amount,
          label: 'Order',
          currencyCode,
          countryCode,
        })
      ).toThrow()
    }
  )

  it('passes a normalized request and the options to native', async () => {
    const onAuthorize = jest.fn(async () => ({ status: 'success' as const }))
    const payment = HybridPaymentHandler.startPayment(
      {
        ...baseRequest,
        paymentItems: [{ label: 'Order', amount: 19.9, type: 'final' }],
      },
      { onAuthorize }
    )
    settlePresentations()

    await expect(payment).resolves.toEqual({ success: true })
    expect(nativeStartPayment()).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentItems: [{ label: 'Order', amount: '19.90', type: 'final' }],
      }),
      { onAuthorize: expect.any(Function) }
    )
    const options = nativeStartPayment().mock.calls[0]![1]
    await expect(options.onAuthorize('token', {})).resolves.toEqual({
      status: 'success',
    })
    expect(onAuthorize).toHaveBeenCalledWith('token', {})
  })

  describe('sheet callbacks', () => {
    // The options native code got for a payment started with `options`.
    const nativeOptions = (options: StartPaymentOptions) => {
      HybridPaymentHandler.startPayment(baseRequest, options)
      settlePresentations()
      return nativeStartPayment().mock.calls[0]![1] as StartPaymentOptions
    }
    const selection: PaymentSheetSelection = { couponCode: 'SAVE10' }

    let warn: jest.SpyInstance
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => warn.mockRestore())

    it('passes the value and selection, and normalizes the update', async () => {
      const onCouponCodeChange = jest.fn(async () => ({
        paymentItems: [
          { label: 'Order', amount: 10, type: 'final' as const },
          { label: 'SAVE10', amount: -1, type: 'final' as const },
        ],
      }))
      const options = nativeOptions({ onCouponCodeChange })

      await expect(
        options.onCouponCodeChange!('SAVE10', selection)
      ).resolves.toEqual({
        paymentItems: [
          { label: 'Order', amount: '10.00', type: 'final' },
          { label: 'SAVE10', amount: '-1.00', type: 'final' },
        ],
      })
      expect(onCouponCodeChange).toHaveBeenCalledWith('SAVE10', selection)
      expect(warn).not.toHaveBeenCalled()
    })

    it('rejects an update it cannot use and says why in development', async () => {
      const options = nativeOptions({
        onShippingAddressChange: async () => ({
          paymentItems: [{ label: 'Refund', amount: -5, type: 'final' }],
        }),
      })

      await expect(
        options.onShippingAddressChange!({ countryCode: 'US' }, selection)
      ).rejects.toThrow('Payment total must not be negative')
      expect(warn).toHaveBeenCalledWith(
        '[react-native-pay] onShippingAddressChange failed, so the payment sheet keeps its items: Payment total must not be negative, got -5.00'
      )
    })

    it('turns a synchronous throw into a rejection', async () => {
      const options = nativeOptions({
        onPaymentMethodChange: () => {
          throw new Error('offline')
        },
      })

      await expect(
        options.onPaymentMethodChange!({ type: 'credit' }, selection)
      ).rejects.toThrow('offline')
    })

    it('leaves out the callbacks that are not set', async () => {
      const options = nativeOptions({
        onShippingMethodChange: async () => ({}),
      })

      expect(Object.keys(options)).toEqual(['onShippingMethodChange'])
    })
  })

  it('calls native without options when none are given', async () => {
    const payment = HybridPaymentHandler.startPayment(baseRequest)
    settlePresentations()
    await payment

    expect(nativeStartPayment().mock.calls[0]).toHaveLength(1)
  })
})
