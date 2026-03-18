# Bare React Native setup (no Expo plugin)

Use this guide when your app is not using Expo config plugins and you need to configure Apple Pay / Google Pay manually in native projects.

## iOS (Apple Pay)

### 1) Add Apple Pay capability

In Xcode:

1. Open your app target.
2. Go to **Signing & Capabilities**.
3. Add the **Apple Pay** capability.
4. Select your Merchant ID (for example `merchant.com.company.app`).

### 2) Verify entitlements and Info.plist

Your app should contain:

- Entitlement key: `com.apple.developer.in-app-payments` with your merchant ID(s).
- Info.plist key: `ReactNativePayApplePayMerchantIdentifiers` with merchant ID(s).

Example `Info.plist` entry:

```xml
<key>ReactNativePayApplePayMerchantIdentifiers</key>
<array>
  <string>merchant.com.company.app</string>
</array>
```

### 3) Apple Developer setup

In Apple Developer:

- Create/verify Merchant ID.
- Enable Apple Pay on your App ID.
- Create a Payment Processing Certificate and configure it in your gateway.

## Android (Google Pay)

### 1) Add Google Pay metadata

In `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<meta-data
  android:name="com.google.android.gms.wallet.api.enabled"
  android:value="true" />
```

### 2) Configure runtime gateway settings

In app code, pass Google Pay config in `usePaymentCheckout` (or `PaymentRequest`):

- `googlePayMerchantId`
- `googlePayEnvironment` (`TEST` for sandbox, `PRODUCTION` for live)
- `googlePayGateway`
- `googlePayGatewayMerchantId`

### 3) Device readiness

- Test on a real device or Play-enabled emulator.
- Ensure Google Play Services is available.
- Ensure at least one wallet card is configured in Google Pay.

## Verify both platforms

- [ ] iOS payment sheet opens and returns a token.
- [ ] Android payment sheet opens and returns a token.
- [ ] Backend can process both token formats with your gateway.

## Related guides

- [iOS (Apple Pay)](/docs/setup/ios-apple-pay)
- [Android (Google Pay)](/docs/setup/android-google-pay)
- [Troubleshooting](/docs/troubleshooting)
