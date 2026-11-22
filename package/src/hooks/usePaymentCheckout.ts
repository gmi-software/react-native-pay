import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import {
  getPaymentHandler,
  PAYMENT_IN_PROGRESS_RESULT,
  prepareStartPaymentOptions,
} from '../paymentHandler'
import type {
  PaymentAmount,
  PaymentRequest,
  PaymentResult,
  PaymentItem,
  PaymentItemKind,
  PayServiceStatus,
  GooglePayAuthMethod,
  GooglePayCheckoutOption,
  GooglePayEnvironment,
  MerchantCapability,
  PayServiceStatusOptions,
  PaymentToken,
  PaymentAuthorizationResult,
  PaymentDetails,
  PaymentErrorCode,
  StartPaymentOptions,
} from '../types'
import { PaymentError } from '../errors'
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

// Wraps what a call threw, keeping its message and the original as `cause`.
function toPaymentError(
  err: unknown,
  fallbackMessage: string,
  code: PaymentErrorCode
): PaymentError {
  const message = err instanceof Error ? err.message : fallbackMessage
  return new PaymentError(message, code, { cause: err })
}

/**
 * Configuration for `usePaymentCheckout`.
 *
 * The sheet callbacks (`onShippingAddressChange`, `onShippingMethodChange`,
 * `onPaymentMethodChange`, `onCouponCodeChange`) work as in
 * `StartPaymentOptions`. What they return changes only the sheet: `items`
 * stays as you set it, so a coupon the payer tried and cancelled leaves no
 * discount behind. Like `onAuthorize`, they can be inline functions.
 */
export interface UsePaymentCheckoutConfig
  extends Pick<
    StartPaymentOptions,
    | 'onShippingAddressChange'
    | 'onShippingMethodChange'
    | 'onPaymentMethodChange'
    | 'onCouponCodeChange'
  > {
  /**
   * Business name shown to the payer on both platforms.
   * On iOS it labels the Apple Pay total, so the sheet reads "Pay <merchantName>".
   * On Android it is sent to Google Pay as `merchantInfo.merchantName`.
   * When omitted, iOS uses the app's display name (`CFBundleDisplayName`) and
   * Android uses the app's label.
   */
  merchantName?: string

  /**
   * Labels the total in the Google Pay sheet. Defaults to `'Total'`.
   * Android only: iOS labels the total with `merchantName`. See
   * `PaymentRequest.totalLabel`.
   */
  totalLabel?: string

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
   * Card networks the payer can pay with, as `PaymentNetwork` values.
   * Defaults to `['visa', 'mastercard', 'amex', 'discover']`.
   * `hasActiveCard` counts only cards on these networks. See
   * `PaymentRequest.supportedNetworks`.
   */
  supportedNetworks?: string[]

  /**
   * Merchant capabilities passed to Apple Pay. On Android, `'Debit'` without
   * `'Credit'` leaves credit cards out. Defaults to `['3DS']`.
   */
  merchantCapabilities?: MerchantCapability[]

  /**
   * Optional Apple Pay Merchant ID override.
   * When omitted, iOS reads the first Merchant ID in the app's
   * Info.plist key `ReactNativePayApplePayMerchantIdentifiers`, which the
   * Expo plugin writes.
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
   * How Google Pay may authenticate the card. Defaults to both
   * `'PAN_ONLY'` and `'CRYPTOGRAM_3DS'`; pass `['CRYPTOGRAM_3DS']` to accept
   * device tokens only. Android only.
   */
  googlePayAllowedAuthMethods?: GooglePayAuthMethod[]

  /**
   * `false` leaves prepaid cards out of the Google Pay sheet, for a gateway or
   * risk policy that refuses them. Defaults to `true`. Android only.
   */
  googlePayAllowPrepaidCards?: boolean

  /**
   * The label of the Google Pay sheet's button: `'default'` ("Continue" or
   * "Pay"), `'completeImmediatePurchase'` ("Pay now") or
   * `'continueToReview'` ("Review Order"). Omitted, Google Pay picks, as with
   * `'default'`. Android only. See `PaymentRequest.googlePayCheckoutOption`.
   */
  googlePayCheckoutOption?: GooglePayCheckoutOption

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
   * A coupon code already applied; `items` must include its discount. Needs
   * `onCouponCodeChange`. iOS only. See `PaymentRequest.couponCode`.
   */
  couponCode?: string

  /**
   * Called with the token after the user authorizes the payment. Charge it on
   * your server and resolve with the outcome; `startPayment` then resolves
   * with `status: 'failed'`, `code: 'PROVIDER_ERROR'` and your `error` on
   * `'failure'`.
   * The Apple Pay or Google Pay sheet waits for it and shows the outcome; on
   * Android the sheet shows your `error`.
   * It must settle within 25 seconds, or the payment fails with a timeout.
   * After a `'failure'` or a timeout the user can retry from the same sheet,
   * which calls this again with a new token. Allow one successful charge
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
      kind?: PaymentItemKind
    }>
  ) => void
  removeItem: (index: number) => void
  updateItem: (index: number, updates: Partial<PaymentItem>) => void
  clearItems: () => void

  // Payment processing
  /**
   * Opens the payment sheet and resolves with the outcome. A payment that
   * can't start, such as with an empty cart or an invalid amount, or whose
   * native call throws resolves with `status: 'failed'` and a `code`, and
   * sets `result` and `error` to match. A call while a payment is in flight
   * resolves with `code: 'IN_PROGRESS'` and leaves `result` and `error` to
   * that payment.
   */
  startPayment: () => Promise<PaymentResult>
  isProcessing: boolean
  /** The last result. A cancel has `status: 'cancelled'` and no `error`. */
  result: PaymentResult | null
  /**
   * Set when a payment fails or can't start; stays `null` on a cancel. The
   * hook always sets a `PaymentError`, with the failed result's `code` and,
   * as `message`, its `error` (`'UNKNOWN'` and `'Payment failed'` when a
   * native result lacks them).
   */
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
 *     isCheckingStatus,
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
 *   if (isCheckingStatus) {
 *     return <ActivityIndicator />
 *   }
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
 *         <ApplePayButton
 *           buttonType="buy"
 *           buttonStyle="black"
 *           onPress={startPayment}
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
  const {
    onAuthorize,
    onShippingAddressChange,
    onShippingMethodChange,
    onPaymentMethodChange,
    onCouponCodeChange,
    ...requestConfig
  } = config

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

  // The latest callbacks, so `startPayment` can stay stable when they change.
  const callbacks: StartPaymentOptions = {
    onAuthorize,
    onShippingAddressChange,
    onShippingMethodChange,
    onPaymentMethodChange,
    onCouponCodeChange,
  }
  const callbacksRef = useRef(callbacks)
  useLayoutEffect(() => {
    callbacksRef.current = callbacks
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
      totalLabel,
      countryCode = 'US',
      currencyCode = 'USD',
      supportedNetworks = ['visa', 'mastercard', 'amex', 'discover'],
      merchantCapabilities = ['3DS'],
      applePayMerchantIdentifier,
      googlePayMerchantId,
      googlePayEnvironment,
      googlePayGateway,
      googlePayGatewayMerchantId,
      googlePayAllowedAuthMethods,
      googlePayAllowPrepaidCards,
      googlePayCheckoutOption,
      billingContactRequired,
      shippingContactRequired,
      emailRequired,
      phoneNumberRequired,
      couponCode,
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
      totalLabel,
      googlePayMerchantId,
      googlePayEnvironment,
      googlePayGateway,
      googlePayGatewayMerchantId,
      googlePayAllowedAuthMethods,
      googlePayAllowPrepaidCards,
      googlePayCheckoutOption,
      billingContactRequired,
      shippingContactRequired,
      emailRequired,
      phoneNumberRequired,
      couponCode,
    })
  }, [stableRequestConfig, items])

  // Check exactly what the payment will use. By value: the request changes
  // with the cart and the rest of the config, these fields rarely do.
  const statusOptionsKey = JSON.stringify({
    supportedNetworks: paymentRequest.supportedNetworks,
    merchantCapabilities: paymentRequest.merchantCapabilities,
    googlePayAllowedAuthMethods: paymentRequest.googlePayAllowedAuthMethods,
    googlePayAllowPrepaidCards: paymentRequest.googlePayAllowPrepaidCards,
    googlePayEnvironment: paymentRequest.googlePayEnvironment,
  } satisfies PayServiceStatusOptions)

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
        kind?: PaymentItemKind
      }>
    ) => {
      const newItems = itemsToAdd.map((item) => ({
        ...createPaymentItem(item.label, item.amount, item.type || 'final'),
        ...(item.kind && { kind: item.kind }),
      }))
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

  const startPayment = useCallback(async (): Promise<PaymentResult> => {
    // Sets `result` and `error` for a payment that failed without a native
    // result, and returns that result.
    const fail = (paymentError: PaymentError): PaymentResult => {
      const failed: PaymentResult = {
        status: 'failed',
        code: paymentError.code,
        success: false,
        error: paymentError.message,
      }
      setResult(failed)
      setError(paymentError)
      return failed
    }

    // The native check covers payments started by HybridPaymentHandler or another hook.
    let isPaymentInProgress: boolean
    try {
      isPaymentInProgress =
        isPaymentInFlight.current || getPaymentHandler().isPaymentInProgress()
    } catch (err) {
      return fail(toPaymentError(err, 'Payment processing failed', 'UNKNOWN'))
    }
    // Leaves `result` and `error` to the payment in flight.
    if (isPaymentInProgress) {
      return { ...PAYMENT_IN_PROGRESS_RESULT }
    }

    if (items.length === 0) {
      return fail(new PaymentError('Cart is empty', 'CONFIGURATION'))
    }

    let validatedRequest: PaymentRequest
    try {
      validatedRequest = normalizePaymentRequest(paymentRequest)
    } catch (err) {
      return fail(toPaymentError(err, String(err), 'CONFIGURATION'))
    }

    isPaymentInFlight.current = true
    setIsProcessing(true)
    setResult(null)
    setError(null)

    const options = prepareStartPaymentOptions(
      callbacksRef.current,
      validatedRequest
    )

    try {
      const paymentResult = options
        ? await getPaymentHandler().startPayment(validatedRequest, options)
        : await getPaymentHandler().startPayment(validatedRequest)

      setResult(paymentResult)

      // A cancel is the user's choice, not an error.
      if (paymentResult.status === 'failed') {
        setError(
          new PaymentError(
            paymentResult.error || 'Payment failed',
            paymentResult.code ?? 'UNKNOWN'
          )
        )
      }

      return paymentResult
    } catch (err) {
      return fail(toPaymentError(err, 'Payment processing failed', 'UNKNOWN'))
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
