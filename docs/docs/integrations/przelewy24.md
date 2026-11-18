# Przelewy24

This cookbook shows how to use `@gmisoftware/react-native-pay` for wallet payments and process them with Przelewy24 on your backend.

The library is not a gateway SDK. It only presents the native payment sheet and returns the payment token that your backend maps to Przelewy24 APIs.

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
3. App receives `PaymentResult` (`status`, `token`).
4. App sends the token and order ID to backend over HTTPS.
5. Backend looks up the order and calls Przelewy24 with its stored amount and platform-appropriate payload mapping.
6. Backend verifies final status and returns checkout result to the app.

## Client implementation (React Native)

The server prices the order, and the sheet shows that amount. The token is charged inside `onAuthorize`, so on iOS the Apple Pay sheet waits for the charge and shows its outcome:

```tsx
import React, {useState} from 'react'
import {ActivityIndicator, Platform, Text, View} from 'react-native'
import {
  ApplePayButton,
  GooglePayButton,
  HybridPaymentHandler,
  createPaymentRequest,
} from '@gmisoftware/react-native-pay'

const API_URL = 'https://api.yourserver.com/payments/przelewy24'

export function CheckoutWithPrzelewy24({
  cartId,
  isSupported,
}: {
  cartId: string
  isSupported: boolean // from HybridPaymentHandler.payServiceStatus()
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPaid, setIsPaid] = useState(false)

  const onPayPress = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      // 1) Your server creates the order and computes its amount. For a cart
      // that already has an order, it returns that order, so a retry after a
      // lost response reuses the same order and idempotency key.
      const orderResponse = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({cartId}),
      })
      if (!orderResponse.ok) {
        setError('Could not create the order. Please try again.')
        return
      }
      const order: {
        orderId: string
        amount: string
        currency: string
        status: 'pending' | 'paid'
      } = await orderResponse.json()
      if (order.status === 'paid') {
        // An earlier attempt was charged: show the confirmation, don't charge again.
        setIsPaid(true)
        return
      }

      // 2) The sheet shows the amount the server will charge.
      const request = createPaymentRequest({
        amount: order.amount,
        label: 'Your Store',
        merchantName: 'Your Store',
        countryCode: 'PL',
        currencyCode: order.currency, // the currency the server charges
        googlePayMerchantId: 'your_google_pay_merchant_id',
        googlePayEnvironment: 'TEST', // switch to PRODUCTION for live traffic
        googlePayGateway: 'przelewy24',
        googlePayGatewayMerchantId: 'your_przelewy24_gateway_merchant_id',
      })

      // 3) Charge the token on your server while the sheet waits.
      const result = await HybridPaymentHandler.startPayment(request, {
        onAuthorize: async (token) => {
          const response = await fetch(`${API_URL}/wallet`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              platform: Platform.OS, // ios | android
              orderId: order.orderId,
              token,
            }),
          })
          if (!response.ok) {
            const {error} = await response.json()
            return {status: 'failure', error}
          }
          return {status: 'success'}
        },
      })
      // result.status is 'success' only when your server reported the charge.
      // Show the order confirmation from your server's order status.
      if (result.status === 'success') {
        setIsPaid(true)
      } else if (result.status === 'failed') {
        // Includes a charge your server declined. On Android the Google Pay
        // sheet has already closed, so this is the only place the payer sees it.
        setError(result.error ?? 'The payment failed. Please try again.')
      }
      // 'cancelled': the payer closed the sheet, so show nothing.
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isPaid) return <Text>Payment received. Thank you!</Text>
  if (!isSupported) return null
  if (isProcessing) return <ActivityIndicator />

  return (
    <View>
      {error ? <Text>{error}</Text> : null}
      {Platform.OS === 'ios' ? (
        <ApplePayButton
          buttonType="buy"
          buttonStyle="black"
          onPress={onPayPress}
          style={{width: '100%', height: 48}}
        />
      ) : (
        <GooglePayButton
          buttonType="buy"
          theme="dark"
          radius={4}
          onPress={onPayPress}
          style={{width: '100%', height: 48}}
        />
      )}
    </View>
  )
}
```

The client's `PaymentResult` is not proof of payment: your server, and Przelewy24's notification to it, are the source of truth for the amount and the payment status. On Android, Google Pay closes its sheet before `onAuthorize` runs; see [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes).

### What to forward to backend

Forward at least:

- `token.paymentData` (opaque payload; token format is platform/provider-dependent)
- order identifier, which your backend uses to look up the amount and currency, and for idempotency
- optional platform marker (`ios` / `android`) to simplify provider mapping

Don't send the amount from the client: the server takes it from the order. Do not parse or transform `paymentData` in the client beyond forwarding it.

## Backend mapping (conceptual example)

Provider field mapping must remain server-side. Keep this as an internal adapter and follow Przelewy24 docs for exact request schemas.

Retries must not charge twice. The client creates the order on every press, and a press can follow a charge whose response never arrived. So:

- `/orders` returns the cart's existing order, with its status, instead of creating another one.
- `/wallet` keys idempotency on the order ID and doesn't charge an order that is already paid.

```ts no-check
app.post('/payments/przelewy24/wallet', async (req, res) => {
  const {platform, token, orderId} = req.body

  // 1) Look up the order: the amount and currency come from it, never from the request.
  const order = await orders.findForUser(orderId, req.user.id)
  if (!order) return res.status(404).json({error: 'Order not found'})
  if (order.status === 'paid') return res.json({success: true, providerPaymentId: order.providerPaymentId})

  // 2) Branch mapping by wallet platform.
  // 3) Build Przelewy24 request with required signatures/merchant fields.
  // 4) Persist payment status and return result.

  const p24Result = await przelewy24Client.createWalletPayment({
    wallet: platform === 'ios' ? 'APPLE_PAY' : 'GOOGLE_PAY',
    // Stored in the currency's minor unit (grosze for PLN), not multiplied here.
    amountMinor: order.amountMinor,
    currency: order.currency,
    orderId: order.id,
    // Not token.transactionIdentifier: it is missing on Android.
    idempotencyKey: `wallet-${order.id}`,
    walletTokenPayload: token?.paymentData,
    rawToken: token,
  })

  res.json({success: true, providerPaymentId: p24Result.id})
})
```

## Security and reliability checklist

- Always use HTTPS between app and backend.
- Never log raw token payloads.
- Take amount and currency from the server-side order, never from the request; check order ownership.
- Use idempotency keys based on your order ID, not on `token.transactionIdentifier`.
- Treat provider callbacks/webhooks and verification as the source of final payment state.

## Notes

- This package does not include a native Przelewy24 SDK adapter; integration is done through your backend.
- For production mapping and validation rules, rely on Przelewy24's official Apple Pay and Google Pay documentation.
