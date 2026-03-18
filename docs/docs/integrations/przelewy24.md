# Przelewy24

This cookbook shows how to use `@gmisoftware/react-native-pay` for wallet payments and process them with Przelewy24 on your backend.

It follows the same contract used across this library:

- the app collects `PaymentResult` and `PaymentToken`
- the backend maps the token to Przelewy24 API calls

## References

- Przelewy24 REST docs (Apple Pay): [developers.przelewy24.pl](https://developers.przelewy24.pl/extended/index.php?pl#tag/Apple-Pay)
- Przelewy24 REST docs (Google Pay): [developers.przelewy24.pl](https://developers.przelewy24.pl/extended/index.php?pl#tag/Google-Pay)
- Przelewy24 payment integration docs entry point: [developers.przelewy24.pl](https://developers.przelewy24.pl/index.php?pl)
- Przelewy24 mobile library docs (registration and verification concepts): [GitHub README](https://github.com/przelewy24/p24-mobile-lib-doc/blob/master/README.md)

Use Przelewy24's official docs as the source of truth for provider request fields, signatures, endpoints, and enablement requirements.

## Prerequisites

### iOS (Apple Pay)

1. Complete [iOS (Apple Pay) setup](/docs/setup/ios-apple-pay):
   - Apple Merchant ID
   - Apple Pay capability enabled on your App ID
   - Payment Processing Certificate
2. Confirm your Przelewy24 account is configured for Apple Pay.
3. Test on a real iOS device with Wallet configured.

### Android (Google Pay)

1. Complete [Android (Google Pay) setup](/docs/setup/android-google-pay):
   - `enableGooglePay: true` (Expo plugin)
   - Google Pay API enabled in Google Cloud
   - gateway config in app code (`googlePayMerchantId`, `googlePayEnvironment`, `googlePayGateway`, `googlePayGatewayMerchantId`)
2. Confirm your Przelewy24 account is configured for Google Pay.
3. Test on a real device (or emulator with Google Play Services) and a wallet card.

### Backend

Implement a backend endpoint that:

- accepts token payloads from app clients
- maps platform-specific token payloads to Przelewy24 fields
- verifies and persists payment status

## End-to-end flow

1. App displays wallet button (`ApplePayButton` on iOS, `GooglePayButton` on Android).
2. User confirms payment in the native sheet.
3. App receives `PaymentResult` (`token`, `transactionId`).
4. App sends token + amount/currency/order data to backend over HTTPS.
5. Backend calls Przelewy24 with platform-appropriate payload mapping.
6. Backend verifies final status and returns checkout result to the app.

## Client implementation (React Native)

```tsx
import React from 'react'
import {Platform, View} from 'react-native'
import {
  ApplePayButton,
  GooglePayButton,
  usePaymentCheckout,
} from '@gmisoftware/react-native-pay'

export function CheckoutWithPrzelewy24() {
  const {startPayment, canMakePayments, isProcessing} = usePaymentCheckout({
    countryCode: 'PL',
    currencyCode: 'PLN',
    googlePayMerchantId: 'your_google_pay_merchant_id',
    googlePayEnvironment: 'TEST', // switch to PRODUCTION for live traffic
    googlePayGateway: 'przelewy24',
    googlePayGatewayMerchantId: 'your_przelewy24_gateway_merchant_id',
  })

  const onPayPress = async () => {
    const result = await startPayment()
    if (!result?.success || !result.token) return

    await fetch('https://api.yourserver.com/payments/przelewy24/wallet', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        platform: Platform.OS, // ios | android
        amount: 49.99,
        currency: 'PLN',
        orderId: 'order_123',
        transactionId: result.transactionId ?? result.token.transactionIdentifier,
        token: result.token,
      }),
    })
  }

  if (!canMakePayments) return null

  return (
    <View>
      {Platform.OS === 'ios' ? (
        <ApplePayButton
          buttonType="buy"
          buttonStyle="black"
          onPress={onPayPress}
          style={{width: '100%', height: 48}}
          disabled={isProcessing}
        />
      ) : (
        <GooglePayButton
          buttonType="buy"
          theme="dark"
          radius={4}
          onPress={onPayPress}
          style={{width: '100%', height: 48}}
          disabled={isProcessing}
        />
      )}
    </View>
  )
}
```

### What to forward to backend

Forward at least:

- `token.paymentData` (opaque payload; token format is platform/provider-dependent)
- `token.transactionIdentifier` and/or `PaymentResult.transactionId`
- order/cart identifier
- amount and currency
- optional platform marker (`ios` / `android`) to simplify provider mapping

Do not parse or transform `paymentData` in the client beyond forwarding it.

## Backend mapping (conceptual example)

Provider field mapping must remain server-side. Keep this as an internal adapter and follow Przelewy24 docs for exact request schemas.

```ts
app.post('/payments/przelewy24/wallet', async (req, res) => {
  const {platform, token, amount, currency, orderId, transactionId} = req.body

  // 1) Validate amount/currency/order ownership server-side.
  // 2) Branch mapping by wallet platform.
  // 3) Build Przelewy24 request with required signatures/merchant fields.
  // 4) Persist payment status and return result.

  const p24Result = await przelewy24Client.createWalletPayment({
    wallet: platform === 'ios' ? 'APPLE_PAY' : 'GOOGLE_PAY',
    amountMinor: Math.round(amount * 100),
    currency,
    orderId,
    idempotencyKey: transactionId ?? token?.transactionIdentifier,
    walletTokenPayload: token?.paymentData,
    rawToken: token,
  })

  res.json({success: true, providerPaymentId: p24Result.id})
})
```

## Security and reliability checklist

- Always use HTTPS between app and backend.
- Never log raw token payloads.
- Validate amount/currency/order ownership server-side.
- Use idempotency keys based on transaction identifiers.
- Treat provider callbacks/webhooks and verification as the source of final payment state.

## Notes

- This package does not include a native Przelewy24 SDK adapter; integration is done through your backend.
- For production mapping and validation rules, rely on Przelewy24's official Apple Pay and Google Pay documentation.
