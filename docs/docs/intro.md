# Introduction

**React Native Pay** is a unified payment module for React Native that supports **Apple Pay** (iOS) and **Google Pay** (Android) through a single, type-safe API for presenting native payment sheets and returning payment tokens.

## What you get

- **One hook** — `usePaymentCheckout()` handles availability, cart, and payment flow.
- **Native buttons** — `ApplePayButton` and `GooglePayButton` for platform-correct UI.
- **Unified API** — Shared request/result model across platforms; button component remains platform-specific.
- **TypeScript** — Full types and IntelliSense for requests, results, and tokens.
- **Expo** — Config plugin for Apple Pay entitlements and Google Pay metadata.
- **Nitro Modules** — High-performance native bindings.

## Who this is for

- React Native apps (Expo or bare) that need **Apple Pay** and/or **Google Pay**.
- Teams that want a single integration instead of maintaining two separate SDKs.
- Apps that already use (or plan to use) a payment gateway (e.g. Stripe, Braintree) and need the **payment token** from the device to charge on the server.

## High-level flow

1. **Check availability** — `canMakePayments` from `usePaymentCheckout()` or `HybridPaymentHandler.payServiceStatus()`.
2. **Build the cart** — `addItem()` / `addItems()` (or build a `PaymentRequest` yourself).
3. **Show the button** — `ApplePayButton` on iOS, `GooglePayButton` on Android.
4. **Start payment** — `startPayment()`; user completes the sheet; you receive a **token**.
5. **Send token to server** — Your backend uses the token with your payment gateway to complete the charge.

The library does not process payments itself; it gives you the token and metadata so your server can.

## What this library does and does not do

### What it does

- Renders native payment buttons (`ApplePayButton` / `GooglePayButton`).
- Starts Apple Pay / Google Pay sheets and returns `PaymentResult` + token payload.
- Provides hook-based cart helpers (`usePaymentCheckout`) and low-level API (`HybridPaymentHandler`).

### What it does not do

- It does **not** charge cards by itself.
- It does **not** replace your gateway SDK/backend payment flow.
- It does **not** bypass Apple Developer / Google Pay onboarding and account setup.

### Still required for production

- Platform setup (Merchant ID, entitlements/capabilities, Google Pay API/project setup).
- Gateway configuration (environment, gateway identifiers, tokenization mode).
- Server-side processing (validation, idempotency, charge/intent creation, error handling).
- Real-device testing on iOS and Android before going live.

## Next steps

- [Quick Start](/docs/quick-start) — Get a minimal checkout running in minutes.
- [Payment flow](/docs/payment-flow) — End-to-end flow in more detail.
- [Installation & Setup](/docs/setup/installation) — Prerequisites and platform setup.
