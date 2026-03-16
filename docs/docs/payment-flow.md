# Payment flow (end-to-end)

This page describes the full payment flow so you can integrate correctly with your backend.

## Overview

The library does **not** charge the user. It:

1. Checks if Apple Pay / Google Pay is available.
2. Lets you build a cart (list of line items).
3. Shows the native payment sheet and returns a **payment token** (plus payment metadata like transaction ids/network details).
4. Your **server** uses that token with your payment gateway (Stripe, Braintree, etc.) to create the charge.

## Step-by-step

| Step | What happens | Where |
|------|----------------|-------|
| 1. Check availability | `canMakePayments` / `payServiceStatus()` | App start or before showing checkout |
| 2. Build cart | `addItem()` / `addItems()` or build `PaymentRequest` | Your checkout UI |
| 3. Show payment button | `ApplePayButton` (iOS) or `GooglePayButton` (Android) | Checkout screen |
| 4. User taps button | You call `startPayment()` | `onPress` handler |
| 5. Native sheet | User selects card, confirms | System UI |
| 6. Token returned | `PaymentResult` with `token` (and `transactionId`) | Your app |
| 7. Send to server | POST token + transactionId (and amount, etc.) to your API | Your code |
| 8. Server charges | Gateway API (Stripe, etc.) using token | Your backend |

## Token format

`PaymentToken.paymentData` is an opaque gateway payload and is **platform/gateway-dependent**:

- **Apple Pay (iOS):** Base64-encoded data from the Apple Pay token payload.
- **Google Pay (Android):** Tokenization payload from Google Pay (`tokenizationData.token`), whose schema depends on your configured gateway.

Always send the **entire token object** (or exactly the fields your gateway asks for) to your backend. Do not parse/transform the payload in the client beyond forwarding it.

## Before production

- [ ] **iOS:** Merchant ID and Payment Processing Certificate set up and installed in your gateway.
- [ ] **Android:** Google Pay API enabled; production gateway merchant ID and environment configured.
- [ ] **Backend:** Endpoint validates the token, amount, and context and uses the gateway SDK to create the charge.
- [ ] **Security:** Never log or expose raw token payloads; use HTTPS and secure storage for any sensitive data.

Next: [API: usePaymentCheckout](/docs/api/use-payment-checkout) or [Server-side processing](/docs/guides/server-processing).
