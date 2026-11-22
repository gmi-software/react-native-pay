import React from 'react'
import { Platform } from 'react-native'
import { render, renderHook, waitFor } from '@testing-library/react-native'

// No mock of react-native-nitro-modules: importing it throws here, as it does
// on web and in an app's Jest tests.
import {
  ApplePayButton,
  GooglePayButton,
  HybridPaymentHandler,
  formatAmount,
  normalizePaymentRequest,
  createPaymentRequest,
  usePaymentCheckout,
} from '../index'

const NATIVE_MODULE_MISSING = /native PaymentHandler is not available/

describe('without the native module', () => {
  let warn: jest.SpyInstance
  let error: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    error.mockRestore()
  })

  it('imports the package and runs its helpers', () => {
    expect(formatAmount(1)).toBe('1.00')
    const request = createPaymentRequest({ amount: 10, label: 'Order' })
    expect(normalizePaymentRequest(request).paymentItems).toHaveLength(1)
  })

  it('throws a clear error when the handler is used', () => {
    let thrown: unknown
    try {
      HybridPaymentHandler.isPaymentInProgress()
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toMatch(NATIVE_MODULE_MISSING)
    expect((thrown as Error).cause).toBeInstanceOf(Error)
  })

  it('reports the hook as unsupported', async () => {
    const { result } = renderHook(() => usePaymentCheckout({}))
    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })
    expect(result.current.isSupported).toBe(false)
    expect(result.current.hasActiveCard).toBe(false)
  })

  it('fails startPayment with the clear error', async () => {
    const { result } = renderHook(() => usePaymentCheckout({}))
    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })
    await expect(result.current.startPayment()).resolves.toBeNull()
    await waitFor(() => {
      expect(result.current.error?.message).toMatch(NATIVE_MODULE_MISSING)
    })
  })

  it('renders nothing for a button on the wrong platform', () => {
    jest.replaceProperty(Platform, 'OS', 'web' as typeof Platform.OS)
    const apple = render(
      <ApplePayButton buttonType="buy" buttonStyle="black" />
    )
    expect(apple.toJSON()).toBeNull()
    const google = render(<GooglePayButton buttonType="buy" theme="dark" />)
    expect(google.toJSON()).toBeNull()
  })
})
