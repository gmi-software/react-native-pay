import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { getPaymentHandler, PAYMENT_IN_PROGRESS_ERROR } from '../paymentHandler'
import type {
  PaymentAmount,
  PaymentRequest,
  PaymentResult,
  PaymentItem,
  PayServiceStatus,
  GooglePayEnvironment,
  MerchantCapability,
  PaymentToken,
  PaymentAuthorizationResult,
} from '../types'
import {
  createPaymentItem,
  calculateTotal,
  normalizePaymentRequest,
  sanitizePaymentRequest,
} from '../utils'

/**
 * Configuration for `usePaymentCheckout`.
 */
export interface UsePaymentCheckoutConfig {
  /**
   * Business name shown to the payer on both platforms.
   * On iOS it labels the Apple Pay total, so the sheet reads "Pay <merchantName>".
   * On Android it is sent to Google Pay as `merchantInfo.merchantName`.
   * When omitted, iOS uses the app's display name (`CFBundleDisplayName`) and
   * Android uses the app's label.
   */
  merchantName?: string

  /**
   * ISO 3166-1 alpha-2 country code for the transaction.
   * Defaults to `'US'`.
   */
  countryCode?: string

  /**
   * ISO 4217 currency code for all payment items.
   * Defaults to `'USD'`.
   */
  currencyCode?: string

  /**
   * Supported card networks for the payment sheet.
   * Defaults to `['visa', 'mastercard', 'amex', 'discover']`.
   */
  supportedNetworks?: string[]

  /**
   * Merchant capabilities passed to Apple Pay.
   * Defaults to `['3DS']`.
   */
  merchantCapabilities?: MerchantCapability[]

  /**
   * Optional Apple Pay Merchant ID override.
   * When omitted, iOS reads the Merchant ID from the app entitlements.
   */
  applePayMerchantIdentifier?: string

  /**
   * Google Pay merchant ID used in Android production requests.
   * Not needed for iOS.
   */
  googlePayMerchantId?: string

  /**
   * Google Pay environment for Android requests.
   * Use `'TEST'` for sandbox flows and `'PRODUCTION'` for live payments.
   */
  googlePayEnvironment?: GooglePayEnvironment

  /**
   * Payment gateway identifier for Google Pay tokenization.
   * Examples include `'stripe'`, `'braintree'`, and `'adyen'`.
   */
  googlePayGateway?: string

  /**
   * Merchant ID provided by your payment gateway for Google Pay tokenization.
   */
  googlePayGatewayMerchantId?: string

  /**
   * Called with the token after the user authorizes the payment. Charge it on
   * your server and resolve with the outcome; `startPayment` then resolves
   * with `success: false` and your `error` on `'failure'`.
   * On iOS the Apple Pay sheet waits for it and shows the outcome. On Android
   * it runs after the Google Pay sheet has closed.
   * It must settle within 25 seconds, or the payment fails with a timeout.
   * On iOS, after a `'failure'` or a timeout the user can retry from the same
   * sheet, which calls this again with a new token. Make the charge idempotent
   * per order ID, not per token.
   */
  onAuthorize?: (token: PaymentToken) => Promise<PaymentAuthorizationResult>
}

export interface UsePaymentCheckoutReturn {
  // Payment availability
  canMakePayments: boolean
  canSetupCards: boolean
  isCheckingStatus: boolean

  // Cart management
  items: PaymentItem[]
  /** Exact decimal sum of `items`; `NaN` if an amount is invalid. */
  total: number
  addItem: (
    label: string,
    amount: PaymentAmount,
    type?: 'final' | 'pending'
  ) => void
  addItems: (
    items: Array<{
      label: string
      amount: PaymentAmount
      type?: 'final' | 'pending'
    }>
  ) => void
  removeItem: (index: number) => void
  updateItem: (index: number, updates: Partial<PaymentItem>) => void
  clearItems: () => void

  // Payment processing
  startPayment: () => Promise<PaymentResult | null>
  isProcessing: boolean
  result: PaymentResult | null
  error: Error | null

  // Utilities
  reset: () => void
  paymentRequest: PaymentRequest
}

/**
 * All-in-one hook for payment checkout flow
 *
 * Handles:
 * - Payment availability checking
 * - Shopping cart management
 * - Payment processing
 * - State management
 *
 * @param config - Hook configuration including locale, supported networks,
 * Apple Pay override, and Google Pay gateway settings.
 * @returns Complete payment checkout interface
 *
 * @example
 * ```typescript
 * function CheckoutScreen() {
 *   const {
 *     canMakePayments,
 *     items,
 *     total,
 *     addItem,
 *     addItems,
 *     removeItem,
 *     startPayment,
 *     isProcessing,
 *     error,
 *   } = usePaymentCheckout({
 *     merchantName: 'Your Store',
 *     currencyCode: 'USD',
 *     countryCode: 'US',
 *     googlePayMerchantId: 'your_google_pay_merchant_id',
 *   })
 *
 *   // Add single item
 *   const handleAddOne = () => addItem('Coffee', 4.99)
 *
 *   // Add multiple items at once
 *   const handleAddCart = () => addItems([
 *     { label: 'Coffee', amount: 4.99 },
 *     { label: 'Sandwich', amount: 8.99 },
 *     { label: 'Tax', amount: 1.20, type: 'final' }
 *   ])
 *
 *   if (!canMakePayments) {
 *     return <Text>Payment not available</Text>
 *   }
 *
 *   return (
 *     <>
 *       <Button title="Add Coffee" onPress={handleAddOne} />
 *       <Button title="Add Cart" onPress={handleAddCart} />
 *       <Text>Total: ${total.toFixed(2)}</Text>
 *       {isProcessing ? (
 *         <ActivityIndicator />
 *       ) : (
 *         // onPress must be wrapped with callback() from react-native-nitro-modules
 *         <ApplePayButton
 *           buttonType="buy"
 *           buttonStyle="black"
 *           onPress={callback(startPayment)}
 *         />
 *       )}
 *       {error && <Text>Error: {error.message}</Text>}
 *     </>
 *   )
 * }
 * ```
 */
export function usePaymentCheckout(
  config: UsePaymentCheckoutConfig
): UsePaymentCheckoutReturn {
  const [status, setStatus] = useState<PayServiceStatus | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  const [items, setItems] = useState<PaymentItem[]>([])

  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Set synchronously, so two calls in the same frame still see each other.
  const isPaymentInFlight = useRef(false)

  useEffect(() => {
    try {
      const paymentStatus = getPaymentHandler().payServiceStatus()
      setStatus(paymentStatus)
    } catch (err) {
      console.error('Failed to check payment status:', err)
      setStatus({ canMakePayments: false, canSetupCards: false })
    } finally {
      setIsCheckingStatus(false)
    }
  }, [])

  const total = useMemo(() => calculateTotal(items), [items])

  const paymentRequest = useMemo<PaymentRequest>(() => {
    const {
      merchantName,
      countryCode = 'US',
      currencyCode = 'USD',
      supportedNetworks = ['visa', 'mastercard', 'amex', 'discover'],
      merchantCapabilities = ['3DS'],
      applePayMerchantIdentifier,
      googlePayMerchantId,
      googlePayEnvironment,
      googlePayGateway,
      googlePayGatewayMerchantId,
    } = config

    return sanitizePaymentRequest({
      countryCode,
      currencyCode,
      supportedNetworks,
      merchantCapabilities,
      paymentItems:
        items.length > 0 ? items : [createPaymentItem('Total', 0, 'final')],
      applePayMerchantIdentifier,
      merchantName,
      googlePayMerchantId,
      googlePayEnvironment,
      googlePayGateway,
      googlePayGatewayMerchantId,
    })
  }, [config, items])

  // Cart operations
  const addItem = useCallback(
    (
      label: string,
      amount: PaymentAmount,
      type: 'final' | 'pending' = 'final'
    ) => {
      const item = createPaymentItem(label, amount, type)
      setItems((prev) => [...prev, item])
    },
    []
  )

  const addItems = useCallback(
    (
      itemsToAdd: Array<{
        label: string
        amount: PaymentAmount
        type?: 'final' | 'pending'
      }>
    ) => {
      const newItems = itemsToAdd.map((item) =>
        createPaymentItem(item.label, item.amount, item.type || 'final')
      )
      setItems((prev) => [...prev, ...newItems])
    },
    []
  )

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateItem = useCallback(
    (index: number, updates: Partial<PaymentItem>) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
      )
    },
    []
  )

  const clearItems = useCallback(() => {
    setItems([])
  }, [])

  const startPayment = useCallback(async (): Promise<PaymentResult | null> => {
    // The native check covers payments started by HybridPaymentHandler or another hook.
    if (
      isPaymentInFlight.current ||
      getPaymentHandler().isPaymentInProgress()
    ) {
      return { success: false, error: PAYMENT_IN_PROGRESS_ERROR }
    }

    if (items.length === 0) {
      const emptyCartError = new Error('Cart is empty')
      setError(emptyCartError)
      return null
    }

    let validatedRequest: PaymentRequest
    try {
      validatedRequest = normalizePaymentRequest(paymentRequest)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      return null
    }

    isPaymentInFlight.current = true
    setIsProcessing(true)
    setResult(null)
    setError(null)

    const { onAuthorize } = config

    try {
      const paymentResult = onAuthorize
        ? await getPaymentHandler().startPayment(validatedRequest, {
            // `async` turns a synchronous return or throw into the Promise native expects.
            onAuthorize: async (token) => onAuthorize(token),
          })
        : await getPaymentHandler().startPayment(validatedRequest)

      setResult(paymentResult)

      if (!paymentResult.success) {
        setError(new Error(paymentResult.error || 'Payment failed'))
      }

      return paymentResult
    } catch (err) {
      const paymentError =
        err instanceof Error ? err : new Error('Payment processing failed')
      setError(paymentError)
      return null
    } finally {
      isPaymentInFlight.current = false
      setIsProcessing(false)
    }
  }, [config, items, paymentRequest])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    // Status
    canMakePayments: status?.canMakePayments ?? false,
    canSetupCards: status?.canSetupCards ?? false,
    isCheckingStatus,

    // Cart
    items,
    total,
    addItem,
    addItems,
    removeItem,
    updateItem,
    clearItems,

    // Payment
    startPayment,
    isProcessing,
    result,
    error,

    // Utilities
    reset,
    paymentRequest,
  }
}
