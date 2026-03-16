# Troubleshooting

Common issues and fixes for React Native Pay.

## iOS

### Apple Pay button not showing

- **Merchant ID:** Must match exactly in Apple Developer and the Expo plugin `merchantIdentifier`. The runtime iOS API reads that entitlement automatically unless you override it with `applePayMerchantIdentifier`.
- **Entitlements:** Run `npx expo prebuild --clean` so the plugin can write the Apple Pay entitlement. In Xcode, confirm the app has the “Apple Pay Payment Processing” capability and the correct Merchant ID.
- **Device:** Prefer a **real device** with a card in Wallet. Simulator has limited Apple Pay support.

### “Cannot make payments” / payment sheet fails

- Add a **valid card** in Settings → Wallet & Apple Pay on the device.
- Confirm the **Merchant ID** is correct and the **App ID** has Apple Pay enabled and is linked to that Merchant ID.
- For production, ensure the **Payment Processing Certificate** for the Merchant ID is created and installed in your payment gateway (e.g. Stripe).

### Build errors after adding the plugin

- Run `npx expo prebuild --clean` and rebuild.
- If using CocoaPods: `cd ios && pod install` and try again.
- See [Common mistakes](/docs/guides/common-mistakes) for plugin and Merchant ID checks.

---

## Android

### Google Pay button not showing

- Set **`enableGooglePay: true`** in the Expo plugin config and run **`npx expo prebuild --clean`**.
- Ensure **Google Play Services** is available (real device or emulator with Google Play).
- Confirm the payment button is only rendered on Android (e.g. `Platform.OS === 'android'` for `GooglePayButton`).

### “Google Pay unavailable”

- User must have **at least one card** in Google Pay on the device.
- For testing, use **`googlePayEnvironment: 'TEST'`** and the test gateway/merchant ID from your payment provider.
- Check **googlePayMerchantId**, **googlePayGateway**, **googlePayGatewayMerchantId**, and **googlePayEnvironment** in your checkout config (see [Android setup](/docs/setup/android-google-pay)).

### Manifest or build errors

- Run `npx expo prebuild --clean` and rebuild.
- Ensure no other plugin removes or overrides the Google Pay metadata added by this plugin.

---

## Build / Nitro

### Nitro or native module not found

- Install **react-native-nitro-modules** (required):  
  `bun add react-native-nitro-modules` (or npm/yarn).
- Run **prebuild** and rebuild the app after adding or updating the payment library.

### Clean rebuild

If native or Nitro issues persist:

```bash
rm -rf node_modules ios/Pods ios/build android/build android/app/build
bun install
cd ios && pod install
```

Then run the app again.

### Type or spec errors in the package

If you are integrating from npm, reinstall dependencies and rebuild the app after upgrading the package.
If you are contributing to the repository itself, use the contributor tooling documented in the project root files.

---

## Still stuck?

- Double-check [Common mistakes](/docs/guides/common-mistakes).
- Open an issue: [GitHub Issues](https://github.com/gmi-software/react-native-pay/issues).
- Ensure you’re on a supported React Native / Nitro / Expo version (see [Compatibility](/docs/compatibility)).
