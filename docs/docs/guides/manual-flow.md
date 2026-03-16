# Manual payment flow (without the hook)

Use `HybridPaymentHandler` and `createPaymentRequest` when you want full control and do not need the hook’s cart state.

## 1. Check availability

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const status = HybridPaymentHandler.payServiceStatus()
if (!status.canMakePayments) {
  // Show "Apple Pay / Google Pay not available"
  return
}
```

## 2. Build the payment request

Either use a helper or build the object yourself:

```ts
import { createPaymentRequest, HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const paymentRequest = createPaymentRequest({
  merchantIdentifier: 'merchant.com.example',
  amount: 99.99,
  label: 'Premium Subscription',
  countryCode: 'US',
  currencyCode: 'USD',
  googlePayEnvironment: 'PRODUCTION',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_merchant_id',
})
```

For multiple line items, build `paymentItems` yourself and pass the full `PaymentRequest`.

## 3. Handle the button press

```ts
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

## 4. Render the button

Use the platform-specific button and, if needed, `callback()` for Nitro:

```tsx
import { Platform } from 'react-native'
import { ApplePayButton, GooglePayButton } from '@gmisoftware/react-native-pay'
import { callback } from 'react-native-nitro-modules'

// ...

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
```

## When to use this

- One-off or fixed-amount payments (e.g. subscription, tip).
- You already have a cart elsewhere and only need to build a `PaymentRequest` once.
- You want to avoid the hook’s internal state.

For cart-based checkout, [usePaymentCheckout](/docs/api/use-payment-checkout) is usually simpler.
