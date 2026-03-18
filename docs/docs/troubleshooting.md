# Troubleshooting

Common issues and fixes for React Native Pay.

## Before you debug

- Ensure your cart is not empty. `startPayment()` returns `null` with a "Cart is empty" error when `items.length === 0`.
- Test on a real device whenever possible (simulator/emulator payment support is limited).
- Re-run native generation after plugin changes:

```bash
npx expo prebuild --clean
```

## iOS (Apple Pay)

### Apple Pay button not showing

- **Merchant ID mismatch:** The Expo plugin `merchantIdentifier` must exactly match your Apple Developer Merchant ID.
- **Missing entitlement/capability:** Confirm "Apple Pay Payment Processing" is enabled in Xcode and linked to the same Merchant ID.
- **Wrong device context:** Prefer a real iPhone with Wallet configured.

### "Cannot make payments" or payment sheet fails

- Add a valid card in **Settings -> Wallet & Apple Pay**.
- Confirm the App ID has Apple Pay enabled and linked to your Merchant ID.
- For production, ensure your Payment Processing Certificate is created and installed in your gateway.

### Invalid Apple button type/style errors

Use only supported Apple button values:

- `buttonType`: `'buy' | 'setUp' | 'book' | 'donate' | 'continue' | 'reload' | 'addMoney' | 'topUp' | 'order' | 'rent' | 'support' | 'contribute' | 'tip'`
- `buttonStyle`: `'white' | 'whiteOutline' | 'black'`

## Android (Google Pay)

### Google Pay button not showing

- Set `enableGooglePay: true` in your Expo plugin config.
- Ensure Google Play Services is available (real device or Play-enabled emulator).
- Render only the Android button on Android (`Platform.OS === 'android'`).

### "Google Pay unavailable"

- Add at least one card in Google Pay on the device.
- Use `googlePayEnvironment: 'TEST'` for test flows.
- Verify `googlePayMerchantId`, `googlePayGateway`, and `googlePayGatewayMerchantId`.

### Manifest/build issues

- Run `npx expo prebuild --clean` and rebuild.
- Ensure no other plugin overrides Google Pay metadata in `AndroidManifest.xml`.

## Nitro callback for onPress

Native payment buttons are Nitro host components. Their `onPress` should be wrapped with `callback()` from `react-native-nitro-modules` to ensure the handler is invoked correctly from native code.

```tsx
import { callback } from 'react-native-nitro-modules'

<ApplePayButton onPress={callback(handlePay)} />
<GooglePayButton onPress={callback(handlePay)} />
```

Use this pattern anywhere you pass handlers to `ApplePayButton` or `GooglePayButton`.

## Build / native module issues

### Nitro or native module not found

- Install `react-native-nitro-modules` (required): `bun add react-native-nitro-modules`.
- Rebuild after adding/upgrading the package.

### Clean rebuild

If native build artifacts are stale:

```bash
rm -rf node_modules ios/Pods ios/build android/build android/app/build
bun install
cd ios && pod install
```

Then rebuild the app.

## Still stuck?

- Ensure you are on supported versions in [Compatibility](/docs/compatibility).
- Open an issue: [GitHub Issues](https://github.com/gmi-software/react-native-pay/issues).
