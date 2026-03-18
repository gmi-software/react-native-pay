# usePaymentCheckout

The main hook for payment checkout. It handles availability, cart state, and payment processing so you can focus on UI and sending the token to your server.

## Import

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'
```

## Configuration

Pass a single config object. iOS reads the Apple Pay merchant ID from the native app configuration. Use `applePayMerchantIdentifier` only if you need to override it at runtime.

Source of truth for these types: [`package/src/hooks/usePaymentCheckout.ts`](https://github.com/gmi-software/react-native-pay/blob/main/package/src/hooks/usePaymentCheckout.ts).

```ts
interface UsePaymentCheckoutConfig {
  merchantName?: string
  countryCode?: string           // default: 'US'
  currencyCode?: string         // default: 'USD'
  supportedNetworks?: string[]  // default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: string[] // default: ['3DS']
  applePayMerchantIdentifier?: string // optional iOS override
  // Google Pay (Android)
  googlePayMerchantId?: string
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}
```

## Return value

```ts
interface UsePaymentCheckoutReturn {
  // Availability
  canMakePayments: boolean
  canSetupCards: boolean
  isCheckingStatus: boolean

  // Cart
  items: PaymentItem[]
  total: number
  addItem: (label: string, amount: number, type?: 'final' | 'pending') => void
  addItems: (items: Array<{ label: string; amount: number; type?: 'final' | 'pending' }>) => void
  removeItem: (index: number) => void
  updateItem: (index: number, updates: Partial<PaymentItem>) => void
  clearItems: () => void

  // Payment
  startPayment: () => Promise<PaymentResult | null>
  isProcessing: boolean
  result: PaymentResult | null
  error: Error | null

  // Utilities
  reset: () => void
  paymentRequest: PaymentRequest
}
```

- **canMakePayments** — Whether the user can pay with Apple Pay / Google Pay on this device.
- **canSetupCards** — Whether the user can add or manage cards (e.g. in Wallet).
- **isCheckingStatus** — `true` while availability is being checked on mount.
- **items** / **total** — Current cart and computed total.
- **startPayment()** — Opens the native sheet. Returns `Promise<PaymentResult | null>`.
  - Returns `null` and sets `error` when the cart is empty.
  - Returns `PaymentResult` (including `{ success: false, error }`) when the native flow completes with a failure result.
  - Returns `null` if an exception is thrown while starting/processing the payment.
- **reset()** — Clears `isProcessing`, `result`, and `error` (does not clear cart).

## Example

```tsx
const {
  canMakePayments,
  items,
  total,
  addItem,
  addItems,
  removeItem,
  startPayment,
  isProcessing,
  error,
  reset,
} = usePaymentCheckout({
  currencyCode: 'USD',
  countryCode: 'US',
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'TEST',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})

// Single item
addItem('Product', 29.99)

// Multiple items
addItems([
  { label: 'Product', amount: 29.99 },
  { label: 'Shipping', amount: 5 },
  { label: 'Tax', amount: 2.8, type: 'final' },
])

const result = await startPayment()
if (result?.success && result.token) {
  // Send result.token to your server
}
```

## Empty cart

If you call `startPayment()` when `items.length === 0`, the hook sets `error` to a “Cart is empty” error and returns `null`. Add at least one item before starting payment.

## Hook vs low-level API

Use `usePaymentCheckout` when you want cart state + defaults managed in React state.

Use [HybridPaymentHandler](/docs/api/hybrid-payment-handler) when you need to build the full `PaymentRequest` yourself (for example custom shipping/contact requirements or prebuilt request payloads from your backend). Utility helpers for this path are documented in [Utility functions](/docs/api/utils).

## Next

- [Components (ApplePayButton / GooglePayButton)](/docs/api/components)
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler) — Low-level API
- [Types](/docs/api/types) — PaymentItem, PaymentResult, PaymentRequest, etc.
