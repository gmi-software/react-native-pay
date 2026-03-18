# Integrations overview

This section explains how to connect `@gmisoftware/react-native-pay` to a payment processor.

## What an integration means in this library

This package handles native Apple Pay / Google Pay sheet presentation and returns a payment token. Your backend then maps that token to your provider's API and completes the charge.

The package is **not** a gateway SDK. It does not directly create charges in providers such as Przelewy24, Stripe, or Braintree.

## Integration flow

1. Configure native platform setup (Apple Pay / Google Pay).
2. Collect a `PaymentResult` in the app (`startPayment()`).
3. Forward the `token`, `transactionId`, amount, and order context to your backend.
4. On the server, call your provider API using the provider's required mapping.
5. Persist status and return final checkout result to the app.

## Start here

- [Payment flow](/docs/payment-flow) for end-to-end responsibilities.
- [Server-side processing](/docs/guides/server-processing) for backend handling basics.
- [Types](/docs/api/types) for `PaymentRequest`, `PaymentResult`, and `PaymentToken`.
- [iOS (Apple Pay)](/docs/setup/ios-apple-pay) for Merchant ID and certificate setup.

## Provider guides

- [Przelewy24](/docs/integrations/przelewy24)
