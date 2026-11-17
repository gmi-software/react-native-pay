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

Use the hook and the platform-specific button. When the user taps pay, your server creates the order for the cart on screen and prices it. Pass `onAuthorize` to charge the token on your server: `startPayment()` resolves with `status: 'success'` only when your server charged the payment. On iOS the Apple Pay sheet waits for your server and shows its answer; on Android, Google Pay closes its sheet before `onAuthorize` runs.

```tsx
import React, { useRef } from 'react'
import {
  usePaymentCheckout,
  ApplePayButton,
  GooglePayButton,
  formatAmount,
} from '@gmisoftware/react-native-pay'
import { Alert, Platform, View, Text, Button, ActivityIndicator } from 'react-native'

function CheckoutScreen() {
  const {
    isSupported,
    isCheckingStatus,
    items,
    total,
    addItem,
    addItems,
    removeItem,
    startPayment,
    isProcessing,
    error,
  } = usePaymentCheckout({
    merchantName: 'Your Store',
    currencyCode: 'USD',
    countryCode: 'US',
    // Charge on your server. The server charges the order's stored amount,
    // not one the app sends, and keys idempotency on the order ID.
    onAuthorize: async (token) => {
      const response = await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId: orderId.current }),
      })
      return response.ok
        ? { status: 'success' }
        : { status: 'failure', error: 'Payment failed' }
    },
  })

  // The server order for the cart on screen, created when the user taps pay.
  const orderId = useRef<string | null>(null)

  const handlePay = async () => {
    // Your server creates an order from the cart and prices it from its own
    // catalog. Send what the user picked (use your product IDs), not prices.
    const orderResponse = await fetch('https://api.yourserver.com/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((item) => item.label) }),
    })
    if (!orderResponse.ok) {
      Alert.alert('Could not create the order. Please try again.')
      return
    }
    const order: { id: string; total: string } = await orderResponse.json()
    // The sheet shows this cart, so it must match what the server charges.
    if (order.total !== formatAmount(total, 'USD')) {
      Alert.alert('Prices have changed. Please review your cart.')
      return
    }
    orderId.current = order.id

    const result = await startPayment()
    if (result?.status === 'success') {
      // Your server charged the payment: show your confirmation here.
    }
    // 'failed': `error` is set, including when your server declined.
    // 'cancelled': the user closed the sheet.
  }

  if (isCheckingStatus) {
    return <View><ActivityIndicator /></View>
  }

  if (!isSupported) {
    return <View><Text>Apple Pay / Google Pay is not available</Text></View>
  }

  return (
    <View style={{ padding: 20 }}>
      <Button title="Add Coffee ($4.99)" onPress={() => addItem('Coffee', 4.99)} />
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', padding: 10 }}>
          <Text>{item.label}: ${formatAmount(item.amount)}</Text>
          <Button title="Remove" onPress={() => removeItem(i)} />
        </View>
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
