# HybridPaymentHandler

Low-level API for payment operations. Use it when you need full control over the payment request and do not want the cart/state from `usePaymentCheckout`.

## Import

```ts
import { HybridPaymentHandler, createPaymentRequest } from '@gmisoftware/react-native-pay'
```

## Methods

### payServiceStatus(options?)

Resolves with whether the device supports the wallet and whether a card is ready. The check runs off the JS thread.

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const status = await HybridPaymentHandler.payServiceStatus({
  supportedNetworks: ['visa', 'mastercard'],
  googlePayEnvironment: 'PRODUCTION',
})
// status: { isSupported: boolean, hasActiveCard: boolean }
```

- **isSupported** — The device can pay with Apple Pay / Google Pay, whether or not a card is set up.
- **hasActiveCard** — The user has a card ready on one of `supportedNetworks`.

Pass the networks, capabilities and Google Pay environment your payment request uses ([PayServiceStatusOptions](/docs/api/types#payservicestatusoptions)). A failed check resolves both flags as `false`, except that on iOS an unknown `merchantCapabilities` value rejects the Promise, as it fails `startPayment`. Without `googlePayEnvironment`, Android asks the `TEST` environment, where `hasActiveCard` is `true` whether or not the user has a card. What each platform checks, and which button to show, is in [Check availability](/docs/guides/availability).

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
  // billingContact, shippingContact, emailAddress, phoneNumber, shippingMethod
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

### canMakePayments(usingNetworks, options?)

Resolves with whether the user has a card ready on one of the given networks, like `hasActiveCard`. Both platforms ask the device. It resolves `false` when no network is one the platform knows.

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const canPay = await HybridPaymentHandler.canMakePayments(['visa', 'mastercard'], {
  googlePayEnvironment: 'PRODUCTION',
})
```

`options` takes `merchantCapabilities` (iOS) and `googlePayEnvironment` (Android, `'TEST'` by default). See [CanMakePaymentsOptions](/docs/api/types#canmakepaymentsoptions).

---

### openPaymentSetup()

iOS only. Opens Wallet (Settings on iPad) so the user can add a card. Call it from a **Set up Apple Pay** button (`ApplePayButton` with `buttonType="setUp"`) when `isSupported` is `true` and `hasActiveCard` is `false`. It does nothing on devices without Apple Pay, and nothing on Android, where the Google Pay sheet lets the user add a card.

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

HybridPaymentHandler.openPaymentSetup()
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
