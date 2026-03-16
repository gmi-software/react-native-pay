# HybridPaymentHandler

Low-level API for payment operations. Use it when you need full control over the payment request and do not want the cart/state from `usePaymentCheckout`.

## Import

```ts
import { HybridPaymentHandler, createPaymentRequest } from '@gmisoftware/react-native-pay'
```

## Methods

### payServiceStatus()

Synchronously returns whether the payment service is available on the device.

```ts
const status = HybridPaymentHandler.payServiceStatus()
// status: { canMakePayments: boolean, canSetupCards: boolean }
```

- **canMakePayments** — User can complete a payment (has a valid card, etc.).
- **canSetupCards** — User can add or manage cards (e.g. Wallet settings).

---

### startPayment(request)

Starts the native payment flow with the given request. Returns a promise that resolves with the payment result.

```ts
const result = await HybridPaymentHandler.startPayment({
  merchantIdentifier: 'merchant.com.example',
  countryCode: 'US',
  currencyCode: 'USD',
  merchantCapabilities: ['3DS'],
  supportedNetworks: ['visa', 'mastercard', 'amex'],
  paymentItems: [{ label: 'Total', amount: 29.99, type: 'final' }],
})
// result: PaymentResult
```

**PaymentResult:**

```ts
interface PaymentResult {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}
```

Build the request yourself or use [createPaymentRequest](/docs/api/utils#createpaymentrequestoptions) for a single line item with defaults.

---

### canMakePayments(usingNetworks)

Returns whether the user can make payments with the given card networks.

```ts
const canPay = HybridPaymentHandler.canMakePayments(['visa', 'mastercard'])
```

## When to use

- Custom checkout flow without the hook’s cart.
- One-off payments where you already have a full `PaymentRequest`.
- Flows that need full request control (for example `shippingType`, `shippingMethods`, `billingContactRequired`, or `shippingContactRequired`).
- Need to check availability or supported networks without using `usePaymentCheckout`.

For most apps, [usePaymentCheckout](/docs/api/use-payment-checkout) is simpler: it builds the request from the cart and manages state.

## Next

- [createPaymentRequest](/docs/api/utils#createpaymentrequestoptions) — Build a request with defaults
- [Types](/docs/api/types) — PaymentRequest, PaymentResult, PaymentToken
