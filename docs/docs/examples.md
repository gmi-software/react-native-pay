# Example app

The repository includes a full example app in the **`example/`** folder: an Expo app that demonstrates the checkout flow with `usePaymentCheckout`, cart management, and platform-specific buttons.

## Key checkout snippet

From `example/app/(tabs)/index.tsx`:

```tsx
import { Platform } from 'react-native'
import {
  ApplePayButton,
  GooglePayButton,
  usePaymentCheckout,
} from '@gmisoftware/react-native-pay'
import { callback } from 'react-native-nitro-modules'

const {
  canMakePayments,
  isCheckingStatus,
  items,
  total,
  addItems,
  clearItems,
  startPayment,
  isProcessing,
  reset,
} = usePaymentCheckout({
  countryCode: 'US',
  currencyCode: 'USD',
})

const handleAddCoffee = () => {
  clearItems()
  addItems([
    { label: 'Coffee', amount: 4.99 },
    { label: 'Tax', amount: 0.5 },
  ])
}

const handlePayment = async () => {
  const paymentResult = await startPayment()
  if (paymentResult?.success) {
    reset()
    clearItems()
  }
}

{Platform.OS === 'ios' ? (
  <ApplePayButton
    buttonType="buy"
    buttonStyle="black"
    onPress={callback(handlePayment)}
    style={{ width: '100%', height: 56 }}
  />
) : (
  <GooglePayButton
    buttonType="buy"
    theme="dark"
    radius={8}
    onPress={callback(handlePayment)}
    style={{ width: '100%', height: 56 }}
  />
)}
```

## What’s in the full example

- **Checkout flow** — Add items (e.g. “Coffee”, “Subscription”), see cart and total, then pay with Apple Pay or Google Pay.
- **Status** — Check whether the device can make payments or only set up cards.
- **Cart UI** — Add/clear items and display total.
- **Result handling** — Success and error messages; reset and clear cart after success.
- **Nitro `callback`** — Buttons use `callback(handlePayment)` (see [Troubleshooting: Nitro callback for onPress](/docs/troubleshooting#nitro-callback-for-onpress)).

## Run the example

From the repo root:

```bash
cd example
bun install
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

Or from the root (if scripts are set up):

```bash
bun run ios
# or
bun run android
```

## What to copy from the example

Use the checkout screen in the example app as a reference for:

1. Calls `usePaymentCheckout` with `countryCode`, `currencyCode`, and optional platform-specific overrides.
2. Shows a loading state while `isCheckingStatus` is true.
3. Renders “Quick Add” buttons that call `addItems` or `addItem`.
4. Displays the cart (items + total) and a “Clear” action.
5. Renders **ApplePayButton** on iOS and **GooglePayButton** on Android with `callback(handlePayment)`.
6. On successful payment, shows an alert and calls `reset()` and `clearItems()`.

Copy these patterns into your app: config setup, cart handling, button usage, and native-safe `onPress` handlers.

## Plugin config in the example

The example’s **`app.json`** includes the React Native Pay plugin (e.g. with a demo Merchant ID and Google Pay enabled). Change the plugin `merchantIdentifier` and any Google Pay runtime settings to your own for real payments.

## Next

- [Quick Start](/docs/quick-start) — Minimal integration in your app
- [API: usePaymentCheckout](/docs/api/use-payment-checkout) — Hook options and return value
- [Troubleshooting](/docs/troubleshooting) — Common integration issues and fixes
