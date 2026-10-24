import { act, renderHook, waitFor } from '@testing-library/react-native'

const mockPayServiceStatus = jest.fn()
const mockStartPayment = jest.fn()
const mockIsPaymentInProgress = jest.fn()

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({
      payServiceStatus: (...args: any[]) => mockPayServiceStatus(...args),
      startPayment: (...args: any[]) => mockStartPayment(...args),
      isPaymentInProgress: (...args: any[]) => mockIsPaymentInProgress(...args),
    })),
  },
}))

import {
  usePaymentCheckout,
  type UsePaymentCheckoutConfig,
} from '../usePaymentCheckout'

const IN_PROGRESS_RESULT = {
  success: false,
  error: 'A payment is already in progress',
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('usePaymentCheckout integration', () => {
  beforeEach(() => {
    mockPayServiceStatus.mockReturnValue({
      canMakePayments: true,
      canSetupCards: true,
    })
    mockStartPayment.mockReset()
    mockIsPaymentInProgress.mockReset().mockReturnValue(false)
  })

  const renderCheckout = () => renderHook(() => usePaymentCheckout({}))

  // A new config object on every render, as an inline literal would be.
  const renderWithConfig = (initialProps: UsePaymentCheckoutConfig) =>
    renderHook(
      (props: UsePaymentCheckoutConfig) => usePaymentCheckout({ ...props }),
      { initialProps }
    )

  it('loads payment service status on mount', async () => {
    const { result } = renderCheckout()

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })

    expect(result.current.canMakePayments).toBe(true)
    expect(result.current.canSetupCards).toBe(true)
  })

  it('falls back to unavailable status when status check fails', async () => {
    mockPayServiceStatus.mockImplementationOnce(() => {
      throw new Error('Native status failure')
    })
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderCheckout()

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })

    expect(result.current.canMakePayments).toBe(false)
    expect(result.current.canSetupCards).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('manages cart operations and total correctly', async () => {
    const { result } = renderCheckout()

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })

    act(() => {
      result.current.addItem('Coffee', 4.5)
      result.current.addItems([
        { label: 'Sandwich', amount: 8.25 },
        { label: 'Tip', amount: 1.25, type: 'pending' },
      ])
    })

    expect(result.current.items).toEqual([
      { label: 'Coffee', amount: 4.5, type: 'final' },
      { label: 'Sandwich', amount: 8.25, type: 'final' },
      { label: 'Tip', amount: 1.25, type: 'pending' },
    ])
    expect(result.current.total).toBeCloseTo(14)

    act(() => {
      result.current.updateItem(0, { amount: 5 })
    })
    expect(result.current.items[0]?.amount).toBe(5)
    expect(result.current.total).toBeCloseTo(14.5)

    act(() => {
      result.current.removeItem(1)
    })
    expect(result.current.items.map((item) => item.label)).toEqual([
      'Coffee',
      'Tip',
    ])

    act(() => {
      result.current.clearItems()
    })
    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('provides default fallback payment item when cart is empty', () => {
    const { result } = renderCheckout()

    expect(result.current.paymentRequest.paymentItems).toEqual([
      { label: 'Total', amount: 0, type: 'final' },
    ])
    expect(result.current.paymentRequest.countryCode).toBe('US')
    expect(result.current.paymentRequest.currencyCode).toBe('USD')
    expect(result.current.paymentRequest.supportedNetworks).toEqual([
      'visa',
      'mastercard',
      'amex',
      'discover',
    ])
    expect(result.current.paymentRequest.merchantCapabilities).toEqual(['3DS'])
    expect(result.current.paymentRequest).not.toHaveProperty(
      'applePayMerchantIdentifier'
    )
    expect(result.current.paymentRequest).not.toHaveProperty('merchantName')
    expect(result.current.paymentRequest).not.toHaveProperty(
      'googlePayMerchantId'
    )
  })

  it('rejects startPayment when cart is empty', async () => {
    const { result } = renderCheckout()

    let paymentResult: any = 'not-called'
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(paymentResult).toBeNull()
    expect(result.current.error?.message).toBe('Cart is empty')
    expect(mockStartPayment).not.toHaveBeenCalled()
  })

  it('handles successful payments', async () => {
    const nativeSuccess = { success: true, transactionId: 'tx_123' }
    mockStartPayment.mockResolvedValueOnce(nativeSuccess)
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Coffee', 4.99)
    })

    let paymentResult: any = null
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(mockStartPayment).toHaveBeenCalledTimes(1)
    expect(mockStartPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentItems: [{ label: 'Coffee', amount: '4.99', type: 'final' }],
      })
    )
    expect(paymentResult).toEqual(nativeSuccess)
    expect(result.current.result).toEqual(nativeSuccess)
    expect(result.current.error).toBeNull()
    expect(result.current.isProcessing).toBe(false)
  })

  it('sends exact decimal strings for number and string amounts', async () => {
    mockStartPayment.mockResolvedValueOnce({ success: true })
    const { result } = renderHook(() =>
      usePaymentCheckout({ currencyCode: 'USD' })
    )

    act(() => {
      result.current.addItems([
        { label: 'Book', amount: 19.99 },
        { label: 'Gift wrap', amount: '19.99' },
        { label: 'Discount', amount: '-5' },
      ])
    })

    expect(result.current.total).toBe(34.98)

    await act(async () => {
      await result.current.startPayment()
    })

    expect(mockStartPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentItems: [
          { label: 'Book', amount: '19.99', type: 'final' },
          { label: 'Gift wrap', amount: '19.99', type: 'final' },
          { label: 'Discount', amount: '-5.00', type: 'final' },
        ],
      })
    )
  })

  it.each([
    ['NaN', NaN, 'finite number or a decimal string'],
    ['a negative total', -1, 'must not be negative'],
    ['too many decimals for USD', 1.005, 'more than 2 decimal places'],
    ['float arithmetic noise', 0.1 + 0.2, 'more than 2 decimal places'],
  ])(
    'rejects %s before calling native code',
    async (_name, amount, message) => {
      const { result } = renderCheckout()

      act(() => {
        result.current.addItem('Order', amount)
      })

      let paymentResult: any = 'not-called'
      await act(async () => {
        paymentResult = await result.current.startPayment()
      })

      expect(paymentResult).toBeNull()
      expect(result.current.error?.message).toContain(message)
      expect(result.current.isProcessing).toBe(false)
      expect(mockStartPayment).not.toHaveBeenCalled()
    }
  )

  it('rejects decimals in zero-decimal currencies', async () => {
    const { result } = renderHook(() =>
      usePaymentCheckout({ currencyCode: 'JPY' })
    )

    act(() => {
      result.current.addItem('Ramen', '1200.5')
    })

    await act(async () => {
      await result.current.startPayment()
    })

    expect(result.current.error?.message).toContain(
      'more than 0 decimal places'
    )
    expect(mockStartPayment).not.toHaveBeenCalled()
  })

  it('starts the next payment after an amount is rejected', async () => {
    mockStartPayment.mockResolvedValueOnce({ success: true })
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 1.005)
    })
    await act(async () => {
      await result.current.startPayment()
    })
    expect(mockStartPayment).not.toHaveBeenCalled()

    act(() => {
      result.current.updateItem(0, { amount: '1.01' })
    })
    let paymentResult: any = null
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(paymentResult).toEqual({ success: true })
    expect(result.current.error).toBeNull()
    expect(mockStartPayment).toHaveBeenCalledTimes(1)
    expect(mockStartPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentItems: [{ label: 'Order', amount: '1.01', type: 'final' }],
      })
    )
  })

  it('sets an error when native payment response has success=false', async () => {
    mockStartPayment.mockResolvedValueOnce({
      success: false,
      error: 'Declined by issuer',
    })
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 9.99)
    })

    await act(async () => {
      await result.current.startPayment()
    })

    expect(result.current.error?.message).toBe('Declined by issuer')
    expect(result.current.result).toEqual({
      success: false,
      error: 'Declined by issuer',
    })
  })

  it('forwards Apple Pay override and Google Pay config when provided', async () => {
    mockStartPayment.mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() =>
      usePaymentCheckout({
        applePayMerchantIdentifier: 'merchant.com.apple.override',
        googlePayMerchantId: 'google-pay-merchant-id',
        googlePayEnvironment: 'PRODUCTION',
        googlePayGateway: 'stripe',
        googlePayGatewayMerchantId: 'gateway-merchant-id',
      })
    )

    act(() => {
      result.current.addItem('Order', 12)
    })

    await act(async () => {
      await result.current.startPayment()
    })

    expect(mockStartPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        applePayMerchantIdentifier: 'merchant.com.apple.override',
        googlePayMerchantId: 'google-pay-merchant-id',
        googlePayEnvironment: 'PRODUCTION',
        googlePayGateway: 'stripe',
        googlePayGatewayMerchantId: 'gateway-merchant-id',
      })
    )
  })

  describe('identity across re-renders', () => {
    it('keeps paymentRequest and startPayment with an inline config', () => {
      const { result, rerender } = renderHook(() =>
        usePaymentCheckout({
          merchantName: 'Store',
          countryCode: 'US',
          currencyCode: 'USD',
          supportedNetworks: ['visa', 'mastercard'],
          merchantCapabilities: ['3DS'],
          onAuthorize: async () => ({ status: 'success' }),
        })
      )
      act(() => {
        result.current.addItem('Coffee', 4.99)
      })
      const { paymentRequest, startPayment } = result.current

      rerender(undefined)

      expect(result.current.paymentRequest).toBe(paymentRequest)
      expect(result.current.startPayment).toBe(startPayment)
    })

    it('keeps paymentRequest when the same config has its keys in another order', () => {
      const { result, rerender } = renderWithConfig({
        countryCode: 'PL',
        currencyCode: 'PLN',
      })
      const { paymentRequest } = result.current

      rerender({ currencyCode: 'PLN', countryCode: 'PL' })

      expect(result.current.paymentRequest).toBe(paymentRequest)
    })

    type RequestConfig = Omit<UsePaymentCheckoutConfig, 'onAuthorize'>

    // A row for every field: a new config field fails typecheck until it has one.
    const configChanges: {
      [K in keyof RequestConfig]-?: readonly [
        NonNullable<RequestConfig[K]>,
        NonNullable<RequestConfig[K]>,
      ]
    } = {
      merchantName: ['Store A', 'Store B'],
      countryCode: ['US', 'PL'],
      currencyCode: ['USD', 'EUR'],
      supportedNetworks: [['visa', 'amex'], ['visa']],
      merchantCapabilities: [['3DS'], ['3DS', 'EMV']],
      applePayMerchantIdentifier: ['merchant.a', 'merchant.b'],
      googlePayMerchantId: ['merchant-a', 'merchant-b'],
      googlePayEnvironment: ['TEST', 'PRODUCTION'],
      googlePayGateway: ['stripe', 'adyen'],
      googlePayGatewayMerchantId: ['gateway-a', 'gateway-b'],
    }

    it.each(Object.entries(configChanges))(
      'compares %s by value',
      (key, [before, after]) => {
        const { result, rerender } = renderWithConfig({
          [key]: structuredClone(before),
        })
        const initial = result.current

        rerender({ [key]: structuredClone(before) })
        expect(result.current.paymentRequest).toBe(initial.paymentRequest)
        expect(result.current.startPayment).toBe(initial.startPayment)

        rerender({ [key]: after })
        expect(result.current.paymentRequest).not.toBe(initial.paymentRequest)
        expect(result.current.paymentRequest).toHaveProperty(key, after)
        expect(result.current.startPayment).not.toBe(initial.startPayment)
      }
    )

    it('starts the payment with the config from the latest render', async () => {
      mockStartPayment.mockResolvedValueOnce({ success: true })
      const { result, rerender } = renderWithConfig({
        currencyCode: 'USD',
        supportedNetworks: ['visa', 'amex'],
      })
      act(() => {
        result.current.addItem('Order', 12)
      })

      rerender({ currencyCode: 'EUR', supportedNetworks: ['visa'] })
      await act(async () => {
        await result.current.startPayment()
      })

      expect(mockStartPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          currencyCode: 'EUR',
          supportedNetworks: ['visa'],
        })
      )
    })
  })

  describe('onAuthorize', () => {
    const token = {
      paymentMethod: { type: 'credit' },
      transactionIdentifier: 'apple-tx',
      paymentData: 'base64-token',
    }

    // Mirrors the native handlers: the merchant's outcome decides the result.
    const nativeWithAuthorization = async (_request: any, options?: any) => {
      try {
        const authorization = await options.onAuthorize(token)
        return authorization.status === 'success'
          ? { success: true, token }
          : {
              success: false,
              error: authorization.error ?? 'Payment authorization failed',
            }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }

    const renderWithAuthorize = (onAuthorize: jest.Mock) => {
      const rendered = renderHook(() => usePaymentCheckout({ onAuthorize }))
      act(() => {
        rendered.result.current.addItem('Order', 12)
      })
      return rendered
    }

    it('does not pass options when onAuthorize is not configured', async () => {
      mockStartPayment.mockResolvedValueOnce({ success: true })
      const { result } = renderCheckout()

      act(() => {
        result.current.addItem('Order', 12)
      })
      await act(async () => {
        await result.current.startPayment()
      })

      expect(mockStartPayment.mock.calls[0]).toHaveLength(1)
    })

    it('passes the token to onAuthorize and returns the token on success', async () => {
      mockStartPayment.mockImplementationOnce(nativeWithAuthorization)
      const onAuthorize = jest.fn().mockResolvedValue({ status: 'success' })
      const { result } = renderWithAuthorize(onAuthorize)

      let paymentResult: any = null
      await act(async () => {
        paymentResult = await result.current.startPayment()
      })

      expect(onAuthorize).toHaveBeenCalledWith(token)
      expect(paymentResult).toEqual({ success: true, token })
      expect(result.current.error).toBeNull()
      expect(mockStartPayment.mock.calls[0]?.[0].paymentItems).toEqual([
        { label: 'Order', amount: '12.00', type: 'final' },
      ])
    })

    it('reports a failure from onAuthorize as an error', async () => {
      mockStartPayment.mockImplementationOnce(nativeWithAuthorization)
      const onAuthorize = jest
        .fn()
        .mockResolvedValue({ status: 'failure', error: 'Card declined' })
      const { result } = renderWithAuthorize(onAuthorize)

      let paymentResult: any = null
      await act(async () => {
        paymentResult = await result.current.startPayment()
      })

      expect(paymentResult).toEqual({ success: false, error: 'Card declined' })
      expect(result.current.error?.message).toBe('Card declined')
    })

    it('hands native a Promise even when onAuthorize throws synchronously', async () => {
      mockStartPayment.mockImplementationOnce(nativeWithAuthorization)
      const onAuthorize = jest.fn(() => {
        throw new Error('Server unreachable')
      })
      const { result } = renderWithAuthorize(onAuthorize)

      await act(async () => {
        await result.current.startPayment()
      })

      const options = mockStartPayment.mock.calls[0]?.[1]
      const returned = options.onAuthorize(token)
      expect(returned).toBeInstanceOf(Promise)
      await expect(returned).rejects.toThrow('Server unreachable')
      expect(result.current.error?.message).toBe('Server unreachable')
    })

    it('keeps startPayment and calls the onAuthorize from the latest render', async () => {
      mockStartPayment.mockImplementationOnce(nativeWithAuthorization)
      const first = jest.fn().mockResolvedValue({ status: 'success' })
      const latest = jest.fn().mockResolvedValue({ status: 'success' })
      const { result, rerender } = renderWithConfig({ onAuthorize: first })
      act(() => {
        result.current.addItem('Order', 12)
      })
      const { startPayment } = result.current

      rerender({ onAuthorize: latest })
      expect(result.current.startPayment).toBe(startPayment)

      await act(async () => {
        await result.current.startPayment()
      })

      expect(latest).toHaveBeenCalledWith(token)
      expect(first).not.toHaveBeenCalled()
    })

    it('passes options only while onAuthorize is configured', async () => {
      mockStartPayment.mockResolvedValue({ success: true })
      const { result, rerender } = renderWithConfig({})
      act(() => {
        result.current.addItem('Order', 12)
      })

      rerender({ onAuthorize: jest.fn() })
      await act(async () => {
        await result.current.startPayment()
      })
      rerender({})
      await act(async () => {
        await result.current.startPayment()
      })

      expect(mockStartPayment.mock.calls[0]?.[1]).toEqual({
        onAuthorize: expect.any(Function),
      })
      expect(mockStartPayment.mock.calls[1]).toHaveLength(1)
    })

    it('keeps the onAuthorize a payment started with when it is removed mid-payment', async () => {
      const native = createDeferred<any>()
      mockStartPayment.mockReturnValueOnce(native.promise)
      const onAuthorize = jest.fn().mockResolvedValue({ status: 'success' })
      const { result, rerender } = renderWithConfig({ onAuthorize })
      act(() => {
        result.current.addItem('Order', 12)
      })

      let payment!: Promise<any>
      act(() => {
        payment = result.current.startPayment()
      })
      rerender({})
      await mockStartPayment.mock.calls[0]?.[1].onAuthorize(token)

      expect(onAuthorize).toHaveBeenCalledWith(token)

      await act(async () => {
        native.resolve({ success: true })
        await payment
      })
    })
  })

  it('uses generic error for non-Error thrown values', async () => {
    mockStartPayment.mockRejectedValueOnce('native crash')
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 12)
    })

    let paymentResult: any = 'not-null'
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(paymentResult).toBeNull()
    expect(result.current.error?.message).toBe('Payment processing failed')
  })

  it('resets transient checkout state', async () => {
    mockStartPayment.mockResolvedValueOnce({ success: false, error: 'Failed' })
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 3)
    })
    await act(async () => {
      await result.current.startPayment()
    })

    expect(result.current.error).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.isProcessing).toBe(false)
  })

  it('starts one native payment when startPayment is called twice synchronously', async () => {
    const native = createDeferred<any>()
    mockStartPayment.mockReturnValueOnce(native.promise)
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 5)
    })

    let first!: Promise<any>
    let second: any
    await act(async () => {
      first = result.current.startPayment()
      second = await result.current.startPayment()
    })

    expect(mockStartPayment).toHaveBeenCalledTimes(1)
    expect(second).toEqual(IN_PROGRESS_RESULT)
    expect(result.current.isProcessing).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()

    const nativeSuccess = { success: true, transactionId: 'tx_1' }
    await act(async () => {
      native.resolve(nativeSuccess)
      await first
    })

    await expect(first).resolves.toEqual(nativeSuccess)
    expect(result.current.result).toEqual(nativeSuccess)
    expect(result.current.isProcessing).toBe(false)
  })

  it('keeps the in-flight guard when reset() runs during a payment', async () => {
    const native = createDeferred<any>()
    mockStartPayment.mockReturnValueOnce(native.promise)
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 5)
    })

    let first!: Promise<any>
    act(() => {
      first = result.current.startPayment()
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.isProcessing).toBe(true)

    let second: any
    await act(async () => {
      second = await result.current.startPayment()
    })

    expect(second).toEqual(IN_PROGRESS_RESULT)
    expect(mockStartPayment).toHaveBeenCalledTimes(1)

    await act(async () => {
      native.resolve({ success: true })
      await first
    })

    expect(result.current.isProcessing).toBe(false)
  })

  it('leaves its state alone when native reports a payment in progress', async () => {
    mockStartPayment.mockResolvedValueOnce({
      success: false,
      error: 'Declined',
    })
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 5)
    })
    await act(async () => {
      await result.current.startPayment()
    })

    const previousResult = result.current.result
    const previousError = result.current.error
    mockIsPaymentInProgress.mockReturnValue(true)

    let paymentResult: any
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(paymentResult).toEqual(IN_PROGRESS_RESULT)
    expect(mockStartPayment).toHaveBeenCalledTimes(1)
    expect(result.current.result).toBe(previousResult)
    expect(result.current.error).toBe(previousError)
    expect(result.current.isProcessing).toBe(false)
  })

  it('reports a payment in progress before an empty cart', async () => {
    mockIsPaymentInProgress.mockReturnValue(true)
    const { result } = renderCheckout()

    let paymentResult: any
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(paymentResult).toEqual(IN_PROGRESS_RESULT)
    expect(result.current.error).toBeNull()
    expect(mockStartPayment).not.toHaveBeenCalled()
  })

  it('accepts a new payment once the previous one settles', async () => {
    mockStartPayment
      .mockRejectedValueOnce(new Error('Native failure'))
      .mockResolvedValueOnce({ success: true })
    const { result } = renderCheckout()

    act(() => {
      result.current.addItem('Order', 5)
    })

    await act(async () => {
      await result.current.startPayment()
    })

    let paymentResult: any = null
    await act(async () => {
      paymentResult = await result.current.startPayment()
    })

    expect(mockStartPayment).toHaveBeenCalledTimes(2)
    expect(paymentResult).toEqual({ success: true })
  })
})
