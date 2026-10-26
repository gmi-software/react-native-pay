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
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const status = HybridPaymentHandler.payServiceStatus()
// status: { canMakePayments: boolean, canSetupCards: boolean }
```

- **canMakePayments** — User can complete a payment (has a valid card, etc.).
- **canSetupCards** — User can add or manage cards (e.g. Wallet settings).

---

### startPayment(request, options?)

Starts the native payment flow with the given request. Returns a promise that resolves with the payment result.

Pass the request through `normalizePaymentRequest` (or build it with `createPaymentRequest`) so amounts are validated before the sheet opens. See [`PaymentAmount`](/docs/api/types#paymentamount).

```ts
import { HybridPaymentHandler, normalizePaymentRequest } from '@gmisoftware/react-native-pay'

const result = await HybridPaymentHandler.startPayment(
  normalizePaymentRequest({
    merchantName: 'Your Store',
    countryCode: 'US',
    currencyCode: 'USD',
    merchantCapabilities: ['3DS'],
    supportedNetworks: ['visa', 'mastercard', 'amex'],
    paymentItems: [{ label: 'Coffee Subscription', amount: '29.99', type: 'final' }],
    googlePayMerchantId: 'your_google_pay_merchant_id',
  })
)
// result: PaymentResult
```

**PaymentResult:**

```ts no-check
interface PaymentResult extends PaymentDetails {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
  // From PaymentDetails, set only when requested:
  // billingContact, shippingContact, emailAddress, phoneNumber
}
```

**options.onAuthorize** charges the token before the Apple Pay sheet closes. The result follows your callback:

```ts no-check
const result = await HybridPaymentHandler.startPayment(request, {
  onAuthorize: async (token) => {
    const charged = await chargeOnServer(token)
    return charged
      ? { status: 'success' }
      : { status: 'failure', error: 'Payment failed' }
  },
})
```

See [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes) for the timeout and Android behavior.

On iOS, the merchant ID is resolved from the app entitlements by default. Use `applePayMerchantIdentifier` only when you need to override the configured value at runtime.

On iOS, the Apple Pay sheet lists your `paymentItems` and then a total labelled with `merchantName` ("Pay Your Store"). The library adds that total for you, so don't add your own "Total" item. Without `merchantName`, the total uses your app's display name.

Build the request yourself or use [createPaymentRequest](/docs/api/utils#createpaymentrequestoptions) for a single line item with defaults.

Only one payment can be in flight at a time, on iOS and Android. A call made while another payment is still in progress, including one started by `usePaymentCheckout`, resolves immediately with `{ success: false, error: 'A payment is already in progress' }` and does not affect the payment in flight. A payment stays in flight until the native side settles it, right before its `startPayment` promise resolves. A new payment can start from that moment, even before your `await` continues. On iOS, the payment settles only after the Apple Pay sheet has closed. With `onAuthorize`, it also waits for your callback to settle or time out, so on iOS the payment ends once both have happened. Use [`isPaymentInProgress()`](#ispaymentinprogress) to check first.

---

### isPaymentInProgress()

Synchronously returns whether a payment started with `startPayment` has not settled yet, including one started by `usePaymentCheckout`. While it returns `true`, `startPayment` resolves immediately with `{ success: false, error: 'A payment is already in progress' }`.

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const isBusy = HybridPaymentHandler.isPaymentInProgress()
```

`startPayment` still checks for itself, so you can call it without checking first. The check is useful when you keep your own state around a payment and don't want to update it for a call that never starts one. `usePaymentCheckout` uses it this way.

---

### canMakePayments(usingNetworks)

Returns whether the user can make payments with the given card networks.

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const canPay = HybridPaymentHandler.canMakePayments(['visa', 'mastercard'])
```

## When to use

- Custom checkout flow without the hook’s cart.
- One-off payments where you already have a full `PaymentRequest`.
- Flows that need full request control (for example `shippingMethods`, `shippingType` or a request built on your backend). Contact details such as `shippingContactRequired` work with both APIs; see [Shipping and contact details](/docs/guides/contact-details).
- Need to check availability or supported networks without using `usePaymentCheckout`.

For most apps, [usePaymentCheckout](/docs/api/use-payment-checkout) is simpler: it builds the request from the cart and manages state.

## Next

- [createPaymentRequest](/docs/api/utils#createpaymentrequestoptions) — Build a request with defaults
- [Types](/docs/api/types) — PaymentRequest, PaymentResult, PaymentToken
