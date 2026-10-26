# usePaymentCheckout

The main hook for payment checkout. It handles availability, cart state, and payment processing so you can focus on UI and sending the token to your server.

## Import

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'
```

## Configuration

Pass a single config object. iOS reads the Apple Pay merchant ID from the native app configuration. Use `applePayMerchantIdentifier` only if you need to override it at runtime.

Source of truth for these types: [`package/src/hooks/usePaymentCheckout.ts`](https://github.com/gmi-software/react-native-pay/blob/main/package/src/hooks/usePaymentCheckout.ts).

```ts no-check
interface UsePaymentCheckoutConfig {
  merchantName?: string          // business name shown on the sheet
  countryCode?: string           // default: 'US'
  currencyCode?: string         // default: 'USD'
  supportedNetworks?: string[]  // default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: MerchantCapability[] // default: ['3DS']
  applePayMerchantIdentifier?: string // optional iOS override
  // Google Pay (Android)
  googlePayMerchantId?: string
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
  googlePayAllowedAuthMethods?: GooglePayAuthMethod[] // default: both
  // Contact details, returned in the result
  billingContactRequired?: boolean
  shippingContactRequired?: boolean
  emailRequired?: boolean
  phoneNumberRequired?: boolean
  // Charge the token before the sheet closes
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
}
```

- **merchantName** — The business name shown to the payer. On iOS, Apple Pay labels the total with it, so the sheet reads "Pay *merchantName*". On Android, it is the merchant name on the Google Pay sheet. Without it, iOS uses your app's display name (`CFBundleDisplayName`) and Android uses the app's label. Set it on both platforms.
- **supportedNetworks** — The card networks the payer can choose, as [PaymentNetwork](/docs/api/types#paymentnetwork) names. Both platforms honour it. A network the platform does not offer is left out, and an unknown name fails the payment. Pass the same list to [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only).
- **googlePayAllowedAuthMethods** — Android only. Which Google Pay cards to accept: `'PAN_ONLY'` (saved to the Google account), `'CRYPTOGRAM_3DS'` (tokenized on the device), or both, the default. See [GooglePayAuthMethod](/docs/api/types#googlepayauthmethod).
- **merchantCapabilities** — The card types to accept and, on iOS, the payment protocols. iOS adds `'3DS'` when neither `'3DS'` nor `'EMV'` is given. On Android only `'Debit'` without `'Credit'` has an effect: it leaves credit cards out. Google Pay cannot leave debit cards out, so `['3DS', 'Credit']` accepts every card type on Android. An unknown value fails the payment on both platforms. Pass the same list to [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only). See [MerchantCapability](/docs/api/types#merchantcapability).
- **supportedNetworks**, **merchantCapabilities**, **googlePayAllowedAuthMethods**, **googlePayEnvironment** — Also used for the availability check, which fails like the payment for a value the payment would refuse. Set `googlePayEnvironment: 'PRODUCTION'` in a live app: in `TEST`, Google Pay reports a card whether or not there is one.
- **billingContactRequired**, **shippingContactRequired**, **emailRequired**, **phoneNumberRequired** — Ask the payer for a billing address, a shipping address, an email address or a phone number. They come back as `result.billingContact`, `result.shippingContact`, `result.emailAddress` and `result.phoneNumber`. See [Shipping and contact details](/docs/guides/contact-details).
- **onAuthorize** — Called with the token and the requested contact details after the user authorizes the payment. Charge it on your server and resolve with `{ status: 'success' }` or `{ status: 'failure', error }`. See [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes). An inline function is fine: `startPayment()` uses the one from the latest render, and a payment keeps that function until it settles, even if the config changes meanwhile.

## Return value

```ts no-check
interface UsePaymentCheckoutReturn {
  // Availability
  isSupported: boolean
  hasActiveCard: boolean
  isCheckingStatus: boolean
  refreshStatus: () => void

  // Cart
  items: PaymentItem[]
  total: number
  addItem: (label: string, amount: PaymentAmount, type?: 'final' | 'pending') => void
  addItems: (items: Array<{ label: string; amount: PaymentAmount; type?: 'final' | 'pending' }>) => void
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

- **isSupported** — The device can pay with Apple Pay / Google Pay, whether or not a card is set up.
- **hasActiveCard** — The user has a card ready on one of `supportedNetworks`. See [PayServiceStatus](/docs/api/types#payservicestatus) for what each platform checks.
- **isCheckingStatus** — `true` until the availability check settles. The hook checks on mount and again when `supportedNetworks`, `merchantCapabilities`, `googlePayAllowedAuthMethods` or `googlePayEnvironment` change. The check never blocks the JS thread.
- **refreshStatus()** — Checks availability again, for example when the app returns from Wallet after `openPaymentSetup()`. `isCheckingStatus` is `true` until it settles, and the flags keep their last values meanwhile.

Which button to show for each combination is in [Check availability](/docs/guides/availability).
- **items** / **total** — Current cart and its exact decimal total, as a number (`NaN` if an amount is invalid). Amounts are `number | string` ([`PaymentAmount`](/docs/api/types#paymentamount)); use `formatAmount(item.amount, currencyCode)` to display them.
- **startPayment()** — Opens the native sheet. Returns `Promise<PaymentResult | null>`.
  - Returns `null` and sets `error` when the cart is empty.
  - Returns `null` and sets `error`, without opening the sheet, when an amount is invalid or the total is negative (see [`PaymentAmount`](/docs/api/types#paymentamount)).
  - Returns `PaymentResult` (including `{ success: false, error }`) when the native flow completes with a failure result.
  - Returns `null` if an exception is thrown while starting/processing the payment.
  - With `onAuthorize`, resolves after your callback settles. A `'failure'` result becomes `{ success: false, error }` and sets `error`.
  - Returns `{ success: false, error: 'A payment is already in progress' }` without opening a second sheet if a payment is still in flight, whether this hook, another `usePaymentCheckout` or [`HybridPaymentHandler`](/docs/api/hybrid-payment-handler) started it. `isProcessing`, `result` and `error` stay as they were. This check comes first, so it also applies when the cart is empty.
- **paymentRequest** / **startPayment** — Keep their identity until a config value or the cart changes. The hook compares the config by value (arrays such as `supportedNetworks` by content), so an inline config object is fine, and both are safe as hook dependencies and props of memoized components.
- **reset()** — Clears `result` and `error` (does not clear cart). It does not clear `isProcessing` while a payment is in flight; `isProcessing` becomes `false` when that payment settles.

## Example

```tsx
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const {
  isSupported,
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
  merchantName: 'Your Store',
  currencyCode: 'USD',
  countryCode: 'US',
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'TEST',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})

// Single item
addItem('Product', 29.99)

// Multiple items; amounts can be numbers or decimal strings
addItems([
  { label: 'Product', amount: 29.99 },
  { label: 'Shipping', amount: '5.00' },
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

Use [HybridPaymentHandler](/docs/api/hybrid-payment-handler) when you need to build the full `PaymentRequest` yourself (for example `shippingMethods`, `shippingType` or prebuilt request payloads from your backend). The hook's `total` covers only the cart, so it doesn't take `shippingMethods`. Utility helpers for this path are documented in [Utility functions](/docs/api/utils).

## Next

- [Components (ApplePayButton / GooglePayButton)](/docs/api/components)
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler) — Low-level API
- [Types](/docs/api/types) — PaymentItem, PaymentResult, PaymentRequest, etc.
