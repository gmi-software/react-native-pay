import { act, renderHook, waitFor } from '@testing-library/react-native'

const mockPayServiceStatus = jest.fn()
const mockStartPayment = jest.fn()

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({
      payServiceStatus: (...args: any[]) => mockPayServiceStatus(...args),
      startPayment: (...args: any[]) => mockStartPayment(...args),
    })),
  },
}))

import { usePaymentCheckout } from '../usePaymentCheckout'

describe('usePaymentCheckout integration', () => {
  beforeEach(() => {
    mockPayServiceStatus.mockReturnValue({
      canMakePayments: true,
      canSetupCards: true,
    })
    mockStartPayment.mockReset()
  })

  const renderCheckout = () =>
    renderHook(() =>
      usePaymentCheckout({})
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
        paymentItems: [{ label: 'Coffee', amount: 4.99, type: 'final' }],
      })
    )
    expect(paymentResult).toEqual(nativeSuccess)
    expect(result.current.result).toEqual(nativeSuccess)
    expect(result.current.error).toBeNull()
    expect(result.current.isProcessing).toBe(false)
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
})
