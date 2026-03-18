import { useState, useCallback, useMemo, useEffect } from 'react'
import { NitroModules } from 'react-native-nitro-modules'
import type { PaymentHandler } from '../specs/PaymentHandler.nitro'

const HybridPaymentHandler =
  NitroModules.createHybridObject<PaymentHandler>('PaymentHandler')
import type {
  PaymentRequest,
  PaymentResult,
  PaymentItem,
  PayServiceStatus,
  GooglePayEnvironment,
} from '../types'
import {
  createPaymentItem,
  calculateTotal,
  sanitizePaymentRequest,
} from '../utils'

/**
 * Configuration for `usePaymentCheckout`.
 */
export interface UsePaymentCheckoutConfig {
  /**
   * Merchant name shown by payment providers that support displaying it.
   * Used primarily by Google Pay.
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
  merchantCapabilities?: string[]

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
}

export interface UsePaymentCheckoutReturn {
  // Payment availability
  canMakePayments: boolean
  canSetupCards: boolean
  isCheckingStatus: boolean

  // Cart management
  items: PaymentItem[]
  total: number
  addItem: (label: string, amount: number, type?: 'final' | 'pending') => void
  addItems: (
    items: Array<{ label: string; amount: number; type?: 'final' | 'pending' }>
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
 *         <ApplePayButton onPress={startPayment} />
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

  useEffect(() => {
    try {
      const paymentStatus = HybridPaymentHandler.payServiceStatus()
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
    (label: string, amount: number, type: 'final' | 'pending' = 'final') => {
      const item = createPaymentItem(label, amount, type)
      setItems((prev) => [...prev, item])
    },
    []
  )

  const addItems = useCallback(
    (
      itemsToAdd: Array<{
        label: string
        amount: number
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
    if (items.length === 0) {
      const emptyCartError = new Error('Cart is empty')
      setError(emptyCartError)
      return null
    }

    setIsProcessing(true)
    setResult(null)
    setError(null)

    try {
      const paymentResult =
        await HybridPaymentHandler.startPayment(paymentRequest)

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
      setIsProcessing(false)
    }
  }, [items, paymentRequest])

  const reset = useCallback(() => {
    setIsProcessing(false)
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
