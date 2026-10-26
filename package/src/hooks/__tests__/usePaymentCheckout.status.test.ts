import { act, renderHook, waitFor } from '@testing-library/react-native'

const mockPayServiceStatus = jest.fn()

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({
      payServiceStatus: (...args: any[]) => mockPayServiceStatus(...args),
    })),
  },
}))

import { usePaymentCheckout } from '../usePaymentCheckout'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('usePaymentCheckout availability', () => {
  beforeEach(() => {
    mockPayServiceStatus.mockReset()
    mockPayServiceStatus.mockResolvedValue({
      isSupported: true,
      hasActiveCard: true,
    })
  })

  const renderCheckout = () => renderHook(() => usePaymentCheckout({}))

  it('loads payment service status on mount', async () => {
    const { result } = renderCheckout()

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })

    expect(result.current.isSupported).toBe(true)
    expect(result.current.hasActiveCard).toBe(true)
  })

  describe('payment service status', () => {
    const SUPPORTED_WITHOUT_CARD = { isSupported: true, hasActiveCard: false }

    it('reports isCheckingStatus until the status check settles', async () => {
      const status = createDeferred<typeof SUPPORTED_WITHOUT_CARD>()
      mockPayServiceStatus.mockReturnValueOnce(status.promise)

      const { result } = renderCheckout()

      expect(result.current.isCheckingStatus).toBe(true)
      expect(result.current.isSupported).toBe(false)
      expect(result.current.hasActiveCard).toBe(false)

      await act(async () => {
        status.resolve(SUPPORTED_WITHOUT_CARD)
      })

      expect(result.current.isCheckingStatus).toBe(false)
      expect(result.current.isSupported).toBe(true)
      expect(result.current.hasActiveCard).toBe(false)
    })

    it.each([
      ['rejects', () => Promise.reject(new Error('Native status failure'))],
      [
        'throws synchronously',
        () => {
          throw new Error('Native status failure')
        },
      ],
    ])(
      'falls back to unavailable status when the check %s',
      async (_, failingCheck) => {
        mockPayServiceStatus.mockImplementationOnce(failingCheck)
        const consoleSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {})

        const { result } = renderCheckout()

        await waitFor(() => {
          expect(result.current.isCheckingStatus).toBe(false)
        })

        expect(result.current.isSupported).toBe(false)
        expect(result.current.hasActiveCard).toBe(false)
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
      }
    )

    it('checks the networks, capabilities, auth methods and environment from the config', async () => {
      const { result } = renderHook(() =>
        usePaymentCheckout({
          supportedNetworks: ['visa', 'mastercard'],
          merchantCapabilities: ['3DS', 'Debit'],
          googlePayAllowedAuthMethods: ['CRYPTOGRAM_3DS'],
          googlePayEnvironment: 'PRODUCTION',
        })
      )

      await waitFor(() => {
        expect(result.current.isCheckingStatus).toBe(false)
      })

      expect(mockPayServiceStatus).toHaveBeenCalledTimes(1)
      expect(mockPayServiceStatus).toHaveBeenCalledWith({
        supportedNetworks: ['visa', 'mastercard'],
        merchantCapabilities: ['3DS', 'Debit'],
        googlePayAllowedAuthMethods: ['CRYPTOGRAM_3DS'],
        googlePayEnvironment: 'PRODUCTION',
      })
    })

    it('checks the defaults the payment request uses', async () => {
      const { result } = renderCheckout()

      await waitFor(() => {
        expect(result.current.isCheckingStatus).toBe(false)
      })

      expect(mockPayServiceStatus).toHaveBeenCalledWith({
        supportedNetworks: result.current.paymentRequest.supportedNetworks,
        merchantCapabilities:
          result.current.paymentRequest.merchantCapabilities,
      })
    })

    it('does not check again when an inline config re-renders unchanged', async () => {
      const { result, rerender } = renderHook(() =>
        usePaymentCheckout({
          supportedNetworks: ['visa'],
          googlePayEnvironment: 'PRODUCTION',
        })
      )
      await waitFor(() => {
        expect(result.current.isCheckingStatus).toBe(false)
      })

      rerender(undefined)
      act(() => {
        result.current.addItem('Coffee', 4.99)
      })

      expect(mockPayServiceStatus).toHaveBeenCalledTimes(1)
      expect(result.current.isCheckingStatus).toBe(false)
    })

    it('checks again when a checked config value changes', async () => {
      const { result, rerender } = renderHook(
        (props: { googlePayEnvironment: 'TEST' | 'PRODUCTION' }) =>
          usePaymentCheckout({ ...props }),
        { initialProps: { googlePayEnvironment: 'TEST' } }
      )
      await waitFor(() => {
        expect(result.current.isCheckingStatus).toBe(false)
      })

      rerender({ googlePayEnvironment: 'PRODUCTION' })

      await waitFor(() => {
        expect(result.current.isCheckingStatus).toBe(false)
      })
      expect(mockPayServiceStatus).toHaveBeenCalledTimes(2)
      expect(mockPayServiceStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ googlePayEnvironment: 'PRODUCTION' })
      )
    })

    it('refreshStatus checks again and reports the new status', async () => {
      const { result } = renderCheckout()
      await waitFor(() => {
        expect(result.current.isCheckingStatus).toBe(false)
      })
      const refreshed = createDeferred<typeof SUPPORTED_WITHOUT_CARD>()
      mockPayServiceStatus.mockReturnValueOnce(refreshed.promise)

      act(() => {
        result.current.refreshStatus()
      })

      expect(result.current.isCheckingStatus).toBe(true)
      expect(mockPayServiceStatus).toHaveBeenCalledTimes(2)

      await act(async () => {
        refreshed.resolve(SUPPORTED_WITHOUT_CARD)
      })

      expect(result.current.isCheckingStatus).toBe(false)
      expect(result.current.hasActiveCard).toBe(false)
    })

    it('ignores a check that settles after a newer one', async () => {
      const first = createDeferred<typeof SUPPORTED_WITHOUT_CARD>()
      const second = createDeferred<typeof SUPPORTED_WITHOUT_CARD>()
      mockPayServiceStatus
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const { result } = renderCheckout()

      act(() => {
        result.current.refreshStatus()
      })
      await act(async () => {
        second.resolve(SUPPORTED_WITHOUT_CARD)
      })
      await act(async () => {
        first.resolve({ isSupported: true, hasActiveCard: true })
      })

      expect(result.current.isCheckingStatus).toBe(false)
      expect(result.current.hasActiveCard).toBe(false)
    })
  })
})
