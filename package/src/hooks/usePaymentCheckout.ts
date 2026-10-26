import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import { getPaymentHandler, PAYMENT_IN_PROGRESS_ERROR } from '../paymentHandler'
import type {
  PaymentAmount,
  PaymentRequest,
  PaymentResult,
  PaymentItem,
  PayServiceStatus,
  PayServiceStatusOptions,
  GooglePayEnvironment,
  MerchantCapability,
  PaymentToken,
  PaymentAuthorizationResult,
  PaymentDetails,
} from '../types'
import {
  createPaymentItem,
  calculateTotal,
  normalizePaymentRequest,
  sanitizePaymentRequest,
} from '../utils'

// Values that survive a JSON round trip unchanged: functions are dropped, and
// NaN and Infinity become null. No objects: a `JSON.stringify` key list would
// filter their keys too.
type JsonValue = string | boolean | null | undefined | readonly JsonValue[]

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
   * Ask for the billing name and postal address, returned as
   * `result.billingContact`. See `PaymentRequest.billingContactRequired`.
   */
  billingContactRequired?: boolean

  /**
   * Ask for the shipping name and postal address, returned as
   * `result.shippingContact`. See `PaymentRequest.shippingContactRequired`.
   */
  shippingContactRequired?: boolean

  /**
   * Ask for an email address, returned as `result.emailAddress`.
   * See `PaymentRequest.emailRequired`.
   */
  emailRequired?: boolean

  /**
   * Ask for a phone number, returned as `result.phoneNumber`. On Android it
   * comes with an address. See `PaymentRequest.phoneNumberRequired`.
   */
  phoneNumberRequired?: boolean

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
   * `details` holds the contact details requested above.
   * An inline function is fine: `startPayment` keeps its identity and uses the
   * function from the latest render. A payment keeps the function it started
   * with until it settles, even if the config changes meanwhile.
   */
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
}

export interface UsePaymentCheckoutReturn {
  // Payment availability
  /** The device supports Apple Pay / Google Pay. See `PayServiceStatus`. */
  isSupported: boolean
  /** A card on `supportedNetworks` is ready. See `PayServiceStatus`. */
  hasActiveCard: boolean
  /** `true` until the availability check settles. */
  isCheckingStatus: boolean
  /** Checks availability again, for example after the user added a card. */
  refreshStatus: () => void

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
 *     isSupported,
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
 *   if (!isSupported) {
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
  const { onAuthorize, ...requestConfig } = config

  // Apps usually pass an inline config, which is new on every render, so
  // compare the rest of it by value, with its keys sorted. A callback added to
  // the config fails `satisfies` here: pull it out above, like `onAuthorize`.
  const requestConfigKey = JSON.stringify(
    requestConfig satisfies { readonly [key: string]: JsonValue },
    Object.keys(requestConfig).sort()
  )
  const stableRequestConfig = useMemo<typeof requestConfig>(
    () => JSON.parse(requestConfigKey),
    [requestConfigKey]
  )

  // The latest callback, so `startPayment` can stay stable when it changes.
  const onAuthorizeRef = useRef(onAuthorize)
  useLayoutEffect(() => {
    onAuthorizeRef.current = onAuthorize
  })

  const [status, setStatus] = useState<PayServiceStatus | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [statusCheck, setStatusCheck] = useState(0)

  const [items, setItems] = useState<PaymentItem[]>([])

  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Set synchronously, so two calls in the same frame still see each other.
  const isPaymentInFlight = useRef(false)

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
      billingContactRequired,
      shippingContactRequired,
      emailRequired,
      phoneNumberRequired,
    } = stableRequestConfig

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
      billingContactRequired,
      shippingContactRequired,
      emailRequired,
      phoneNumberRequired,
    })
  }, [stableRequestConfig, items])

  // Check exactly what the payment will use. By value: the request changes
  // with the cart and the rest of the config, these fields rarely do.
  const statusOptionsKey = JSON.stringify({
    supportedNetworks: paymentRequest.supportedNetworks,
    merchantCapabilities: paymentRequest.merchantCapabilities,
    googlePayEnvironment: paymentRequest.googlePayEnvironment,
  })

  useEffect(() => {
    // Ignores a check that settles after a newer one started or after unmount.
    let isCurrent = true
    const options: PayServiceStatusOptions = JSON.parse(statusOptionsKey)

    const checkStatus = async () => {
      setIsCheckingStatus(true)
      let nextStatus: PayServiceStatus
      try {
        nextStatus = await getPaymentHandler().payServiceStatus(options)
      } catch (err) {
        console.error('Failed to check payment status:', err)
        nextStatus = { isSupported: false, hasActiveCard: false }
      }
      if (isCurrent) {
        setStatus(nextStatus)
        setIsCheckingStatus(false)
      }
    }
    checkStatus()

    return () => {
      isCurrent = false
    }
  }, [statusOptionsKey, statusCheck])

  const refreshStatus = useCallback(() => {
    setStatusCheck((check) => check + 1)
  }, [])

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
    let isPaymentInProgress: boolean
    try {
      isPaymentInProgress =
        isPaymentInFlight.current || getPaymentHandler().isPaymentInProgress()
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Payment processing failed')
      )
      return null
    }
    if (isPaymentInProgress) {
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

    const authorize = onAuthorizeRef.current

    try {
      const paymentResult = authorize
        ? await getPaymentHandler().startPayment(validatedRequest, {
            // `async` turns a synchronous return or throw into the Promise native expects.
            onAuthorize: async (token, details) => authorize(token, details),
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
  }, [items, paymentRequest])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    // Status
    isSupported: status?.isSupported ?? false,
    hasActiveCard: status?.hasActiveCard ?? false,
    isCheckingStatus,
    refreshStatus,

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
