# Quick Start

Get a minimal Apple Pay / Google Pay checkout running in your app.

## What this quick start covers

- Native button rendering and payment-sheet trigger.
- Charging the token on your backend while the sheet waits (`onAuthorize`).
- Getting back a `PaymentResult` that reflects your server's answer.

This guide does **not** replace platform onboarding (Apple/Google) or gateway-specific backend implementation.

## 1. Prerequisites

- React Native **0.70+**
- **react-native-nitro-modules** **0.36.0+** (required)
- **Android minSdkVersion** **26+** (required)
- **Expo 53–57** if you use Expo (SDK 57 requires Node.js 22.13+)

## 2. Install dependencies

```bash
# Install Nitro Modules first
bun add react-native-nitro-modules
# or: npm install react-native-nitro-modules

# Then the payment library
bun add @gmisoftware/react-native-pay
```

## 3. Native configuration

Apply platform setup before testing checkout:

- [Installation](/docs/setup/installation) for dependency + setup flow.
- [Expo plugin](/docs/setup/expo-plugin) for Expo projects.
- [iOS Apple Pay setup](/docs/setup/ios-apple-pay) for Merchant ID and certificates.
- [Android Google Pay setup](/docs/setup/android-google-pay) for Google Pay API and gateway configuration.
- [Bare React Native setup](/docs/setup/bare-react-native) for manual native configuration.

If you are using Expo, run `npx expo prebuild --clean` after plugin changes and rebuild.

## 4. Minimal checkout screen

Use the hook and the platform-specific button. Your server creates the order and prices it; the screen shows its lines and pays for that order. Pass `onAuthorize` to charge the token on your server: `startPayment()` resolves with `status: 'success'` only when your server charged the payment. On iOS the Apple Pay sheet waits for your server and shows its answer; on Android, Google Pay closes its sheet before `onAuthorize` runs.

```tsx
import React, { useEffect } from 'react'
import {
  usePaymentCheckout,
  ApplePayButton,
  GooglePayButton,
  formatAmount,
} from '@gmisoftware/react-native-pay'
import { Platform, View, Text, ActivityIndicator } from 'react-native'

// An order your server created and priced, for example when the user opened
// checkout. Use your own type.
type Order = {
  id: string
  lines: { label: string; amount: string }[]
}

function CheckoutScreen({ order }: { order: Order }) {
  const {
    // Payment availability
    isSupported,
    isCheckingStatus,

    // Cart
    items,
    total,
    addItems,
    clearItems,

    // Payment processing
    startPayment,
    isProcessing,
    error,
  } = usePaymentCheckout({
    merchantName: 'Your Store',
    currencyCode: 'USD',
    countryCode: 'US',
    // Charge on your server. It charges the order's stored amount, not one
    // the app sends, and keys idempotency on the order ID, so a retry after
    // a timeout can't charge twice.
    onAuthorize: async (token) => {
      const response = await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId: order.id }),
      })
      return response.ok
        ? { status: 'success' }
        : { status: 'failure', error: 'Payment failed' }
    },
  })

  // The sheet shows the lines your server priced. startPayment() returns
  // null for an empty cart, so fill it before the user taps pay.
  useEffect(() => {
    addItems(order.lines)
    return clearItems
  }, [order, addItems, clearItems])

  const handlePay = async () => {
    const result = await startPayment()
    if (result?.status === 'success') {
      // Your server charged the payment: show your confirmation here.
    }
    // 'failed': `error` is set, including when your server declined or
    // could not be reached.
    // 'cancelled': the user closed the sheet, and `error` stays null.
  }

  if (isCheckingStatus) {
    return <View><ActivityIndicator /></View>
  }

  if (!isSupported) {
    return <View><Text>Apple Pay / Google Pay is not available</Text></View>
  }

  return (
    <View style={{ padding: 20 }}>
      {items.map((item, index) => (
        <Text key={index}>{item.label}: ${formatAmount(item.amount)}</Text>
      ))}
      <Text style={{ fontSize: 20, marginVertical: 10 }}>Total: ${total.toFixed(2)}</Text>
      {error && <Text style={{ color: 'red' }}>Error: {error.message}</Text>}
      {isProcessing ? (
        <ActivityIndicator size="large" />
      ) : (
        Platform.OS === 'ios' ? (
          <ApplePayButton buttonType="buy" buttonStyle="black" onPress={handlePay} style={{ width: '100%', height: 48 }} />
        ) : (
          <GooglePayButton buttonType="buy" theme="dark" radius={4} onPress={handlePay} style={{ width: '100%', height: 48 }} />
        )
      )}
    </View>
  )
}
```

Without `onAuthorize`, Apple Pay shows its success checkmark as soon as the user authorizes, and `startPayment()` resolves with `status: 'success'` before your server has charged anything. Don't tell the user the payment succeeded until your server answers. See [Server-side processing](/docs/guides/server-processing#charge-before-the-sheet-closes) for timeouts, retries and Android behavior.

If the user builds the cart in the app, have your server create or update the order for that cart before the user taps pay, and keep the same order ID across retries so the idempotency key stays the same. See [Dynamic cart](/docs/guides/dynamic-cart).

If you are integrating with Przelewy24, follow the provider cookbook: [Przelewy24](/docs/integrations/przelewy24).

## 5. Run and test

- **iOS:** Real device with a card in Wallet; Simulator has limited support.
- **Android:** Real device or emulator with Google Play Services; add a card in Google Pay.
- For **Google Pay**, configure `googlePayMerchantId`, `googlePayEnvironment`, `googlePayGateway`, and `googlePayGatewayMerchantId` when you move to a real gateway (see [Android setup](/docs/setup/android-google-pay) and [API: usePaymentCheckout](/docs/api/use-payment-checkout)).

## 6. Before you ship

- [ ] `react-native-nitro-modules` and `@gmisoftware/react-native-pay` installed.
- [ ] Native config done (Expo plugin + prebuild, or bare iOS entitlements + Android manifest).
- [ ] Checkout screen uses `usePaymentCheckout` and the platform-specific button.
- [ ] Apple and/or Google account/platform configuration is complete.
- [ ] Backend endpoint validates order amount/currency and processes the token with your gateway.
- [ ] Idempotency and retry handling are implemented server-side.
- [ ] Real-device tests passed on iOS and Android.

Next: [Payment flow](/docs/payment-flow) or [Installation & Setup](/docs/setup/installation).
