# Manual payment flow (without the hook)

Use `HybridPaymentHandler` and `createPaymentRequest` when you want full control and do not need the hook’s cart state.

## 1. Check availability

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const status = await HybridPaymentHandler.payServiceStatus({
  supportedNetworks: ['visa', 'mastercard', 'amex'],
  googlePayEnvironment: 'PRODUCTION',
})
if (!status.isSupported) {
  // Hide the pay button and show "Apple Pay / Google Pay not available"
}
```

Pass the same networks and Google Pay environment as the payment request in step 2. On iOS, when `isSupported` is `true` but `hasActiveCard` is `false`, you can show a **Set up Apple Pay** button instead; see [Check availability](/docs/guides/availability).

## 2. Build the payment request

Either use a helper or build the object yourself:

```ts
import { createPaymentRequest, HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const paymentRequest = createPaymentRequest({
  amount: 99.99,
  label: 'Premium Subscription',
  merchantName: 'Your Store',
  countryCode: 'US',
  currencyCode: 'USD',
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'PRODUCTION',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_merchant_id',
})
```

`createPaymentRequest` throws if the amount is invalid (see [`PaymentAmount`](/docs/api/types#paymentamount)). For multiple line items, build `paymentItems` yourself and pass the full `PaymentRequest` through `normalizePaymentRequest`, which applies the same checks. On iOS, the Merchant ID is read from the app entitlements unless you explicitly pass `applePayMerchantIdentifier`.

## 3. Handle the button press

```ts no-check
const handlePayment = async () => {
  try {
    const result = await HybridPaymentHandler.startPayment(paymentRequest)
    if (result.success && result.token) {
      await sendTokenToServer(result.token, result.transactionId)
    } else {
      console.error('Payment failed:', result.error)
    }
  } catch (err) {
    console.error('Payment error:', err)
  }
}
```

To charge the token before the Apple Pay sheet closes, pass `startPayment(paymentRequest, { onAuthorize })` and charge inside the callback instead of calling `sendTokenToServer` afterwards, so the token isn't charged twice. See [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes).

## 4. Render the button

Use the platform-specific button, and pass it `status.isSupported` from step 1 so it stays hidden when payments are unavailable. Its `onPress` must be wrapped with `callback()` from `react-native-nitro-modules`, or the tap does nothing:

```tsx
import { Platform } from 'react-native'
import { ApplePayButton, GooglePayButton } from '@gmisoftware/react-native-pay'
import { callback } from 'react-native-nitro-modules'

function PaymentButton({
  isSupported,
  handlePayment,
}: {
  isSupported: boolean
  handlePayment: () => Promise<void>
}) {
  if (!isSupported) return null

  return Platform.OS === 'ios' ? (
    <ApplePayButton
      buttonType="buy"
      buttonStyle="black"
      onPress={callback(handlePayment)}
    />
  ) : (
    <GooglePayButton
      buttonType="subscribe"
      theme="dark"
      onPress={callback(handlePayment)}
    />
  )
}
```

## When to use this

- One-off or fixed-amount payments (e.g. subscription, tip).
- You already have a cart elsewhere and only need to build a `PaymentRequest` once.
- You want to avoid the hook’s internal state.

For cart-based checkout, [usePaymentCheckout](/docs/api/use-payment-checkout) is usually simpler.
