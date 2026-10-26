# Check availability

Decide which wallet button to show before the user taps anything. The library reports two flags, checked without blocking the JS thread:

- **isSupported**: the device can pay with Apple Pay or Google Pay, whether or not a card is set up.
- **hasActiveCard**: the user has a card ready on one of your `supportedNetworks`.

## What each flag checks

| | iOS | Android |
|---|---|---|
| `isSupported` | `PKPaymentAuthorizationViewController.canMakePayments()`: hardware and parental controls allow Apple Pay | `isReadyToPay`: Google Pay is available, and the user has a card or can add one |
| `hasActiveCard` | `canMakePayments(usingNetworks:capabilities:)` with your `supportedNetworks` and `merchantCapabilities` | `isReadyToPay` with `existingPaymentMethodRequired: true` and your `supportedNetworks` |

Both flags are `false` when the check fails or, on Android, when Google Pay does not answer within 5 seconds. One exception: on iOS, an unknown `merchantCapabilities` value rejects the `payServiceStatus` Promise, as it fails `startPayment`. The hook logs the rejection and reports both flags as `false`. `hasActiveCard` is also `false` when none of the networks is one the platform knows (Google Pay has no `idcredit` or `privateLabel`).

### Ask the environment you pay in

On Android, the check goes to the Google Pay environment you pass as `googlePayEnvironment`, `'TEST'` by default. In `TEST`, Google Pay answers `hasActiveCard: true` whether or not the user has a card ([Google's reference](https://developers.google.com/pay/api/android/reference/request-objects#IsReadyToPayRequest)), so a production app must pass `'PRODUCTION'` to get real answers. An emulator with no Google account signed in answered `false` even in `TEST`, so test both signed-in and signed-out devices.

## Show the right button

- **Android**: show the Google Pay button when `isSupported` is `true`. A user without a card adds one in the Google Pay sheet. Google offers no separate setup screen, so `openPaymentSetup()` does nothing on Android.
- **iOS**: show the Apple Pay buy button when `hasActiveCard` is `true`. When only `isSupported` is `true`, show the **Set up Apple Pay** button (`buttonType="setUp"`) and call `HybridPaymentHandler.openPaymentSetup()` on tap. It opens Wallet (Settings on iPad) to add a card.
- **Neither platform**: when `isSupported` is `false`, hide the wallet buttons and offer another way to pay.

In the example below, the checkout screen owns the hook and the cart, and `WalletButton` picks the button from the status. The user comes back from Wallet with a card the status does not know about yet, so the screen checks again when the app returns to the foreground:

```tsx
import { useEffect } from 'react'
import { AppState, Button, Platform, View } from 'react-native'
import { callback } from 'react-native-nitro-modules'
import {
  ApplePayButton,
  GooglePayButton,
  HybridPaymentHandler,
  usePaymentCheckout,
  type UsePaymentCheckoutReturn,
} from '@gmisoftware/react-native-pay'

export function CheckoutScreen() {
  const checkout = usePaymentCheckout({
    merchantName: 'Your Store',
    supportedNetworks: ['visa', 'mastercard'],
    // The environment you pay in, so the status is real in production.
    googlePayEnvironment: 'PRODUCTION',
    googlePayMerchantId: 'your_google_pay_merchant_id',
    googlePayGateway: 'stripe',
    googlePayGatewayMerchantId: 'your_stripe_merchant_id',
  })
  const { refreshStatus } = checkout

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshStatus()
    })
    return () => subscription.remove()
  }, [refreshStatus])

  return (
    <View>
      <Button
        title="Add Coffee"
        onPress={() => checkout.addItem('Coffee', '4.99')}
      />
      {checkout.items.length > 0 && <WalletButton checkout={checkout} />}
    </View>
  )
}

function WalletButton({ checkout }: { checkout: UsePaymentCheckoutReturn }) {
  const { isSupported, hasActiveCard, startPayment } = checkout

  // `isSupported` is `false` until the first check settles, and a refresh
  // keeps the last answer, so the button does not flicker on return.
  if (!isSupported) return null

  if (Platform.OS === 'android') {
    return (
      <GooglePayButton
        buttonType="buy"
        theme="dark"
        onPress={callback(startPayment)}
      />
    )
  }

  return hasActiveCard ? (
    <ApplePayButton
      buttonType="buy"
      buttonStyle="black"
      onPress={callback(startPayment)}
    />
  ) : (
    <ApplePayButton
      buttonType="setUp"
      buttonStyle="black"
      onPress={callback(() => HybridPaymentHandler.openPaymentSetup())}
    />
  )
}
```

The hook checks on mount, and again when `supportedNetworks`, `merchantCapabilities` or `googlePayEnvironment` change. `isCheckingStatus` is `true` while a check runs; the flags keep their last values until it settles.

## Without the hook

`HybridPaymentHandler.payServiceStatus()` returns a `Promise`. Pass the same networks, capabilities and environment as your payment request:

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const { isSupported, hasActiveCard } =
  await HybridPaymentHandler.payServiceStatus({
    supportedNetworks: ['visa', 'mastercard'],
    merchantCapabilities: ['3DS'],
    googlePayEnvironment: 'PRODUCTION',
  })
```

## Next

- [usePaymentCheckout](/docs/api/use-payment-checkout): the hook's availability fields
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler): `payServiceStatus` and `openPaymentSetup`
- [Components](/docs/api/components): `ApplePayButton` and `GooglePayButton`
