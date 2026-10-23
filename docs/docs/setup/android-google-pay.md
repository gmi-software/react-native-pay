# Android (Google Pay)

Configure your app and Google Pay for Android.

## 1. Expo plugin

In `app.json` (or `app.config.js`), enable Google Pay:

```json
{
  "expo": {
    "plugins": [
      ["@gmisoftware/react-native-pay", { "enableGooglePay": true }]
    ]
  }
}
```

Use the same plugin with `merchantIdentifier` if you also support iOS.

## 2. Google Cloud / Google Pay API

1. In [Google Cloud Console](https://console.cloud.google.com/), open your project.
2. Enable the **Google Pay API** for the project.

For production, Google must also approve your app in the Google Pay & Wallet Console. See [Production access](/docs/guides/testing#production-access).

## 3. Gateway configuration (in app code)

Google Pay needs a **Google Pay merchant ID** for production, plus your **payment gateway** details (Stripe, Braintree, etc.) and **gateway merchant ID**. Configure them in `usePaymentCheckout` (or in your `PaymentRequest`):

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

usePaymentCheckout({
  merchantName: 'Your Store',      // shown on the Google Pay sheet
  currencyCode: 'USD',
  countryCode: 'US',
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'TEST',   // or 'PRODUCTION'
  googlePayGateway: 'stripe',    // or braintree, square, adyen, etc.
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})
```

If you omit `merchantName`, the Google Pay sheet shows your app's label (`android:label` in the manifest).

Supported gateways include: `stripe`, `braintree`, `square`, `adyen`, `authorizenet`, `checkoutltd`. See [Google Pay Gateway Tokens](https://developers.google.com/pay/api/android/reference/request-objects#gateway) for the full list and exact identifiers.

## 4. Prebuild and run

```bash
npx expo prebuild --clean
npx expo run:android
```

## Testing

- Use a **real device** or an **emulator with a Google Play system image**, signed in to a Google account.
- In `googlePayEnvironment: 'TEST'`, Google Pay shows its test cards, and the tokens can't be charged. See [TEST environment](/docs/guides/testing#test-environment) for what it can't verify and how to get a token your gateway accepts.
- `PRODUCTION` needs Google's approval. See [Production access](/docs/guides/testing#production-access).
- Before each release, run the [release checklist](/docs/guides/testing#release-checklist).

## Troubleshooting

- **Button not showing:** Ensure `enableGooglePay: true` is set, prebuild was run, and Google Play Services is available.
- **Google Pay unavailable:** Add a card in Google Pay on the device; for testing use `googlePayEnvironment: 'TEST'` and correct gateway config.
- See [Troubleshooting](/docs/troubleshooting#android-google-pay) for more.

If you are integrating with Przelewy24, see [Przelewy24](/docs/integrations/przelewy24) for an end-to-end app + backend flow.
