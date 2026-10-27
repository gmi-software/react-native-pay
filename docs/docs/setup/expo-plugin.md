# Expo Config Plugin

The **@gmisoftware/react-native-pay** Expo config plugin configures native projects so Apple Pay and Google Pay work without manual edits.

## Usage

Add the plugin to `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      [
        "@gmisoftware/react-native-pay",
        {
          "merchantIdentifier": "merchant.com.yourcompany.app",
          "enableGooglePay": true
        }
      ]
    ]
  }
}
```

## Options

Both options are optional. Listed without options (`"plugins": ["@gmisoftware/react-native-pay"]`), the plugin changes nothing.

| Option | Type | Description |
|--------|------|-------------|
| `merchantIdentifier` | `string` or `string[]` | Apple Pay Merchant ID(s). If omitted, Apple Pay entitlements are not added. Each ID should start with `merchant.`; prebuild warns when one does not. |
| `enableGooglePay` | `boolean` | `true` adds the Google Pay metadata (`com.google.android.gms.wallet.api.enabled`) to the Android manifest. `false` removes it. If omitted, the manifest is left as it is, so an entry added by another plugin (Stripe, for example) stays. |

## Examples

**iOS only (Apple Pay):**

```json
["@gmisoftware/react-native-pay", { "merchantIdentifier": "merchant.com.example.app" }]
```

**Android only (Google Pay):**

```json
["@gmisoftware/react-native-pay", { "enableGooglePay": true }]
```

**Both platforms:**

```json
["@gmisoftware/react-native-pay", {
  "merchantIdentifier": "merchant.com.example.app",
  "enableGooglePay": true
}]
```

**Multiple Merchant IDs (iOS):**

```json
["@gmisoftware/react-native-pay", {
  "merchantIdentifier": ["merchant.com.example.app", "merchant.com.example.other"],
  "enableGooglePay": true
}]
```

## After changing the plugin

Run:

```bash
npx expo prebuild --clean
```

Then rebuild and run the app.

## Next

- [iOS (Apple Pay)](/docs/setup/ios-apple-pay) — Create Merchant ID and certificates
- [Android (Google Pay)](/docs/setup/android-google-pay) — Enable Google Pay and set gateway
