# Quick Start

Get a minimal Apple Pay / Google Pay checkout running in your app.

## What this quick start covers

- Native button rendering and payment-sheet trigger.
- Getting back `PaymentResult` and `token`.
- Forwarding the token to your backend.

This guide does **not** replace platform onboarding (Apple/Google) or gateway-specific backend implementation.

## 1. Prerequisites

- React Native **0.70+**
- **react-native-nitro-modules** **0.31.4+** (required)
- **Expo 53+** if you use Expo

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

If you are using Expo, run `npx expo prebuild --clean` after plugin changes and rebuild.

## 4. Minimal checkout screen

Use the hook and the platform-specific button. On press, call `startPayment()` and send the token to your server.

```tsx
import React from 'react'
import {
  usePaymentCheckout,
  ApplePayButton,
  GooglePayButton,
} from '@gmisoftware/react-native-pay'
import { Platform, View, Text, Button, ActivityIndicator } from 'react-native'

function CheckoutScreen() {
  const {
    canMakePayments,
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
    currencyCode: 'USD',
    countryCode: 'US',
  })

  const handlePay = async () => {
    const result = await startPayment()
    if (result?.success && result.token) {
      // Send result.token to your backend
      await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: result.token,
          transactionId: result.transactionId,
        }),
      })
    }
  }

  if (isCheckingStatus) {
    return <View><ActivityIndicator /></View>
  }

  if (!canMakePayments) {
    return <View><Text>Apple Pay / Google Pay is not available</Text></View>
  }

  return (
    <View style={{ padding: 20 }}>
      <Button title="Add Coffee ($4.99)" onPress={() => addItem('Coffee', 4.99)} />
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', padding: 10 }}>
          <Text>{item.label}: ${item.amount.toFixed(2)}</Text>
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

If you are integrating with Przelewy24, follow the provider cookbook: [Przelewy24](/docs/integrations/przelewy24).

## 5. Nitro and button `onPress` (if needed)

If your button `onPress` does not fire (e.g. with Nitro host components), wrap the handler with `callback` from `react-native-nitro-modules`:

```tsx
import { callback } from 'react-native-nitro-modules'

<ApplePayButton
  buttonType="buy"
  buttonStyle="black"
  onPress={callback(handlePay)}
  style={{ width: '100%', height: 48 }}
/>
```

## 6. Run and test

- **iOS:** Real device with a card in Wallet; Simulator has limited support.
- **Android:** Real device or emulator with Google Play Services; add a card in Google Pay.
- For **Google Pay**, configure `googlePayMerchantId`, `googlePayEnvironment`, `googlePayGateway`, and `googlePayGatewayMerchantId` when you move to a real gateway (see [Android setup](/docs/setup/android-google-pay) and [API: usePaymentCheckout](/docs/api/use-payment-checkout)).

## 7. Production checklist (required)

- [ ] Apple and/or Google account/platform configuration is complete.
- [ ] Backend endpoint validates order amount/currency and processes the token with your gateway.
- [ ] Idempotency and retry handling are implemented server-side.
- [ ] Real-device tests passed on iOS and Android.

## Checklist

- [ ] `react-native-nitro-modules` and `@gmisoftware/react-native-pay` installed
- [ ] Native config done: Expo plugin + prebuild, or bare iOS entitlements + Android manifest
- [ ] Checkout screen uses `usePaymentCheckout` and platform-specific button
- [ ] Backend endpoint ready to accept and process the payment token

Next: [Payment flow](/docs/payment-flow) or [Installation & Setup](/docs/setup/installation).
