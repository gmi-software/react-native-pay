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
import { createPaymentItem, calculateTotal } from '../utils'

export interface UsePaymentCheckoutConfig {
  merchantIdentifier: string
  countryCode?: string
  currencyCode?: string
  supportedNetworks?: string[]
  merchantCapabilities?: string[]
  googlePayEnvironment?: GooglePayEnvironment
  googlePayGateway?: string
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
 * @param config - Payment configuration
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
 *     merchantIdentifier: 'merchant.com.example',
 *     currencyCode: 'USD',
 *     countryCode: 'US',
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
  // Payment status state
  const [status, setStatus] = useState<PayServiceStatus | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  // Cart state
  const [items, setItems] = useState<PaymentItem[]>([])

  // Payment state
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Check payment status on mount
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

  // Calculate total
  const total = useMemo(() => calculateTotal(items), [items])

  // Build payment request
  const paymentRequest = useMemo<PaymentRequest>(() => {
    const {
      merchantIdentifier,
      countryCode = 'US',
      currencyCode = 'USD',
      supportedNetworks = ['visa', 'mastercard', 'amex', 'discover'],
      merchantCapabilities = ['3DS'],
      googlePayEnvironment,
      googlePayGateway,
      googlePayGatewayMerchantId,
    } = config

    return {
      merchantIdentifier,
      countryCode,
      currencyCode,
      supportedNetworks,
      merchantCapabilities,
      paymentItems:
        items.length > 0 ? items : [createPaymentItem('Total', 0, 'final')],
      googlePayEnvironment,
      googlePayGateway,
      googlePayGatewayMerchantId,
    }
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

  // Start payment
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

  // Reset all state
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
