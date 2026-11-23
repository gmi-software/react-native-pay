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
  totalLabel?: string            // Google Pay total label, default: 'Total'
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
  googlePayAllowPrepaidCards?: boolean // default: true
  googlePayCheckoutOption?: GooglePayCheckoutOption // the sheet's button label
  // Contact details, returned in the result
  billingContactRequired?: boolean
  shippingContactRequired?: boolean
  emailRequired?: boolean
  phoneNumberRequired?: boolean
  couponCode?: string           // iOS: a code already applied
  // Charge the token before the sheet closes
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
  // Update the cart in the sheet (coupons: iOS only)
  onShippingAddressChange?: StartPaymentOptions['onShippingAddressChange']
  onShippingMethodChange?: StartPaymentOptions['onShippingMethodChange']
  onPaymentMethodChange?: StartPaymentOptions['onPaymentMethodChange']
  onCouponCodeChange?: StartPaymentOptions['onCouponCodeChange']
}
```

- **merchantName** — The business name shown to the payer. On iOS, Apple Pay labels the total with it, so the sheet reads "Pay *merchantName*". On Android, it is the merchant name on the Google Pay sheet. Without it, iOS uses your app's display name (`CFBundleDisplayName`) and Android uses the app's label. Set it on both platforms.
- **totalLabel** — Android only. The label of the total in the Google Pay sheet, such as `'Razem'`. Defaults to `'Total'`. iOS labels the total with `merchantName`. See [PaymentRequest](/docs/api/types#paymentrequest).
- **supportedNetworks** — The card networks the payer can choose, as [PaymentNetwork](/docs/api/types#paymentnetwork) names. Both platforms honour it. A network the platform does not offer is left out, and an unknown name fails the payment. Pass the same list to [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only).
- **googlePayAllowedAuthMethods** — Android only. Which Google Pay cards to accept: `'PAN_ONLY'` (saved to the Google account), `'CRYPTOGRAM_3DS'` (tokenized on the device), or both, the default. See [GooglePayAuthMethod](/docs/api/types#googlepayauthmethod).
- **googlePayAllowPrepaidCards** — Android only. `false` leaves prepaid cards out of the Google Pay sheet, for a gateway or risk policy that refuses them; without it, the payer learns only when the charge fails. Defaults to `true`. Pass the same value to [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only).
- **googlePayCheckoutOption** — Android only. The label of the Google Pay sheet's button: `'default'` ("Continue" or "Pay", as when it is omitted), `'completeImmediatePurchase'` ("Pay now") or `'continueToReview'` ("Review Order"). `'completeImmediatePurchase'` needs a final total: with a `'pending'` item, `startPayment()` fails with a `'CONFIGURATION'` error before the sheet opens. See [GooglePayCheckoutOption](/docs/api/types#googlepaycheckoutoption).
- **merchantCapabilities** — The card types to accept and, on iOS, the payment protocols. iOS adds `'3DS'` when neither `'3DS'` nor `'EMV'` is given. On Android only `'Debit'` without `'Credit'` has an effect: it leaves credit cards out. Google Pay cannot leave debit cards out, so `['3DS', 'Credit']` accepts every card type on Android. An unknown value fails the payment on both platforms. Pass the same list to [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only). See [MerchantCapability](/docs/api/types#merchantcapability).
- **supportedNetworks**, **merchantCapabilities**, **googlePayAllowedAuthMethods**, **googlePayAllowPrepaidCards**, **googlePayEnvironment** — Also used for the availability check, which fails like the payment for a value the payment would refuse. Set `googlePayEnvironment: 'PRODUCTION'` in a live app: in `TEST`, Google Pay reports a card whether or not there is one. Omitted, it is `'TEST'`, and an Android release build logs a warning once per app run when `startPayment()` builds a payment. The availability check alone logs nothing.
- **billingContactRequired**, **shippingContactRequired**, **emailRequired**, **phoneNumberRequired** — Ask the payer for a billing address, a shipping address, an email address or a phone number. They come back as `result.billingContact`, `result.shippingContact`, `result.emailAddress` and `result.phoneNumber`. See [Shipping and contact details](/docs/guides/contact-details).
- **onAuthorize** — Called with the token and the requested contact details after the user authorizes the payment. Charge it on your server and resolve with `{ status: 'success' }` or `{ status: 'failure', error }`. See [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes). An inline function is fine: `startPayment()` uses the one from the latest render, and a payment keeps that function until it settles, even if the config changes meanwhile.
- **onShippingAddressChange**, **onShippingMethodChange**, **onPaymentMethodChange**, **onCouponCodeChange** — Update the cart while the sheet is open, as in [`StartPaymentOptions`](/docs/api/types#startpaymentoptions). What they return changes only the sheet: `items` stays as you set it, so a coupon the payer tried and then cancelled leaves no discount behind. Inline functions are fine, as for `onAuthorize`. Android has no coupon field and differs in a few ways; see [On Android](/docs/guides/dynamic-cart#on-android). See [Update the cart in the sheet](/docs/guides/dynamic-cart#update-the-cart-in-the-sheet).
- **couponCode** — A coupon code already applied, shown in the sheet's coupon field. `items` must already include its discount. Needs `onCouponCodeChange`. iOS only.

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
  addItems: (items: Array<{ label: string; amount: PaymentAmount; type?: 'final' | 'pending'; kind?: PaymentItemKind }>) => void
  removeItem: (index: number) => void
  updateItem: (index: number, updates: Partial<PaymentItem>) => void
  clearItems: () => void

  // Payment
  startPayment: () => Promise<PaymentResult>
  isProcessing: boolean
  result: PaymentResult | null   // last result; check result.status
  error: Error | null            // a PaymentError with a `code`; null after a cancel

  // Utilities
  reset: () => void
  paymentRequest: PaymentRequest
}
```

- **isSupported** — The device can pay with Apple Pay / Google Pay, whether or not a card is set up.
- **hasActiveCard** — The user has a card ready on one of `supportedNetworks`. See [PayServiceStatus](/docs/api/types#payservicestatus) for what each platform checks.
- **isCheckingStatus** — `true` until the availability check settles. The hook checks on mount and again when `supportedNetworks`, `merchantCapabilities`, `googlePayAllowedAuthMethods`, `googlePayAllowPrepaidCards` or `googlePayEnvironment` change. The check never blocks the JS thread.
- **refreshStatus()** — Checks availability again, for example when the app returns from Wallet after `openPaymentSetup()`. `isCheckingStatus` is `true` until it settles, and the flags keep their last values meanwhile.

Which button to show for each combination is in [Check availability](/docs/guides/availability).
- **items** / **total** — Current cart and its exact decimal total, as a number (`NaN` if an amount is invalid). Amounts are `number | string` ([`PaymentAmount`](/docs/api/types#paymentamount)); use `formatAmount(item.amount, currencyCode)` to display them.
- **startPayment()** — Opens the native sheet. Returns `Promise<PaymentResult>` and never rejects, so check `status` and `code` (see [Error codes](/docs/payment-flow#error-codes)). Except for `'IN_PROGRESS'`, it also sets `result` to what it returns, and sets `error` to a `PaymentError` with its `code` whenever `status` is `'failed'` (`'UNKNOWN'` if a native result has none).
  - Returns `{ status: 'failed', code: 'CONFIGURATION', success: false, error: 'Cart is empty' }` when the cart is empty.
  - Returns `status: 'failed'` and `code: 'CONFIGURATION'`, without opening the sheet, when an amount is invalid or the total is negative (see [`PaymentAmount`](/docs/api/types#paymentamount)). `error` holds the validation message, and the validation error is in the hook's `error.cause`. [`HybridPaymentHandler`](/docs/api/hybrid-payment-handler) returns the same result.
  - Returns the native `PaymentResult` when the sheet closes.
  - A cancel returns `status: 'cancelled'` and `code: 'CANCELLED'`. It sets `result` but leaves `error` as `null`, so the user closing the sheet doesn't show up as a failed payment.
  - Any other failure from the native flow returns `status: 'failed'` with its `code`, and sets `error` with the same `code` and the result's message. A result without them gets `code: 'UNKNOWN'` and the message `'Payment failed'`.
  - Returns `status: 'failed'` and `code: 'UNKNOWN'` if an exception is thrown while starting/processing the payment, with the thrown message in `error` (`'Payment processing failed'` if it wasn't an `Error`). What was thrown is in the hook's `error.cause`.
  - With `onAuthorize`, resolves after your callback settles. A `'failure'` result becomes `{ status: 'failed', code: 'PROVIDER_ERROR', error }` and sets `error`.
  - Returns `{ status: 'failed', code: 'IN_PROGRESS', success: false, error: 'A payment is already in progress' }` without opening a second sheet if a payment is still in flight, whether this hook, another `usePaymentCheckout` or [`HybridPaymentHandler`](/docs/api/hybrid-payment-handler) started it. `isProcessing`, `result` and `error` stay as they were. This check comes first, so it also applies when the cart is empty.
- **error** — A [`PaymentError`](/docs/api/types#paymenterror) whenever it is set. Its `code` uses the [error codes](/docs/payment-flow#error-codes) of `PaymentResult` and matches the failed result's `code`, except that a native result without a `code` gives `'UNKNOWN'`. `'IN_PROGRESS'` doesn't set it, so branch on the returned result. It is state: read it in the render after `startPayment()` settles, and narrow it with `instanceof PaymentError` to read `code`.
- **paymentRequest** / **startPayment** — Keep their identity until a config value or the cart changes. The hook compares the config by value (arrays such as `supportedNetworks` by content), so an inline config object is fine, and both are safe as hook dependencies and props of memoized components.
- **reset()** — Clears `result` and `error` (does not clear cart). It does not clear `isProcessing` while a payment is in flight; `isProcessing` becomes `false` when that payment settles. Call it after `startPayment()` resolves, once you no longer need `result`, so the token doesn't stay in the hook's state. Calling it inside `onAuthorize` is too early: the hook stores the result after the callback settles.

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
  { label: 'Tax', amount: 2.8, type: 'final', kind: 'tax' }, // TAX line on Google Pay
])

const result = await startPayment()
if (result.status === 'success' && result.token) {
  // Send result.token to your server, then drop it from the hook's state.
  reset()
}
// 'cancelled': the user closed the sheet; `error` stays null.
// 'failed': result.code says why. `error` is set too, except for 'IN_PROGRESS'.
```

## Empty cart

If you call `startPayment()` when `items.length === 0`, it returns `status: 'failed'` with `code: 'CONFIGURATION'` and sets `error` to a “Cart is empty” error. Add at least one item before starting payment.

## Hook vs low-level API

Use `usePaymentCheckout` when you want cart state + defaults managed in React state.

Use [HybridPaymentHandler](/docs/api/hybrid-payment-handler) when you need to build the full `PaymentRequest` yourself (for example `shippingMethods`, `shippingType`, [subscriptions and later payments](/docs/guides/merchant-tokens) or prebuilt request payloads from your backend). The hook's `total` covers only the cart, so it doesn't take `shippingMethods`, `recurring`, `deferred` or `automaticReload`. Utility helpers for this path are documented in [Utility functions](/docs/api/utils).

## Next

- [Components (ApplePayButton / GooglePayButton)](/docs/api/components)
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler) — Low-level API
- [Types](/docs/api/types) — PaymentItem, PaymentResult, PaymentRequest, etc.
