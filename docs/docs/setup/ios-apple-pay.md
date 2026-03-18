# iOS (Apple Pay)

Configure your app and Apple Developer account for Apple Pay.

## 1. Expo plugin

In `app.json` (or `app.config.js`), add the plugin with your Merchant ID:

```json
{
  "expo": {
    "plugins": [
      ["@gmisoftware/react-native-pay", { "merchantIdentifier": "merchant.com.yourcompany.app" }]
    ]
  }
}
```

The runtime API reads this Merchant ID from the native app entitlements automatically. You only need `applePayMerchantIdentifier` in code if you want to override the configured value at runtime.

## 2. Apple Developer setup

### Create a Merchant ID

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list/merchant).
2. Create a new **Merchant ID** (e.g. `merchant.com.yourcompany.app`).
3. Note it exactly; it must match the plugin and your code.

### Enable Apple Pay on your App ID

1. In Identifiers, select your **App ID**.
2. Enable **Apple Pay Payment Processing**.
3. Associate the Merchant ID you created.

### Payment Processing Certificate

1. In the Merchant ID page, create a **Payment Processing Certificate**.
2. Follow Apple’s steps (CSR, etc.) and download the certificate.
3. Install it in your **payment processor** (e.g. Stripe, Braintree) as per their docs. The library does not process payments; your gateway uses this certificate to validate tokens.

If you are integrating with Przelewy24, see [Przelewy24](/docs/integrations/przelewy24) for an end-to-end app + backend flow.

## 3. Prebuild and run

```bash
npx expo prebuild --clean
npx expo run:ios
```

## Testing

- Use a **real device** with a card added in Wallet for full flow.
- Simulator has limited Apple Pay support; for production-like testing, use a device.

## Troubleshooting

- **Button not showing / “Cannot make payments”:** Ensure Merchant ID matches exactly, entitlements are present after prebuild, and the device has Wallet & Apple Pay set up with a valid card.
- See [Troubleshooting](/docs/troubleshooting#ios) for more.
