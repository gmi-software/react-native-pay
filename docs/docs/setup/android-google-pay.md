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

For production you will also need to register your app and comply with Google’s requirements (screenshots, business info, etc.).

## 3. Gateway configuration (in app code)

Google Pay needs a **payment gateway** (Stripe, Braintree, etc.) and a **gateway merchant ID**. Configure them in `usePaymentCheckout` (or in your `PaymentRequest`):

```ts
usePaymentCheckout({
  merchantIdentifier: 'merchant.com.yourcompany.app',
  currencyCode: 'USD',
  countryCode: 'US',
  googlePayEnvironment: 'TEST',   // or 'PRODUCTION'
  googlePayGateway: 'stripe',    // or braintree, square, adyen, etc.
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})
```

Supported gateways include: `stripe`, `braintree`, `square`, `adyen`, `authorizenet`, `checkoutltd`. See [Google Pay Gateway Tokens](https://developers.google.com/pay/api/android/reference/request-objects#gateway) for the full list and exact identifiers.

## 4. Prebuild and run

```bash
npx expo prebuild --clean
npx expo run:android
```

## Testing

- Use a **real device** or an **emulator with Google Play Services**.
- Add a test card in Google Pay.
- For testing without a live gateway, use `googlePayEnvironment: 'TEST'` and a test merchant ID if your gateway provides one.

## Troubleshooting

- **Button not showing:** Ensure `enableGooglePay: true` is set, prebuild was run, and Google Play Services is available.
- **Google Pay unavailable:** Add a card in Google Pay on the device; for testing use `googlePayEnvironment: 'TEST'` and correct gateway config.
- See [Troubleshooting](/docs/troubleshooting#android) for more.
