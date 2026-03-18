# Server-side processing

After a successful payment, your app receives a **token** and optional **transactionId**. Your backend must use this token with your payment gateway (Stripe, Braintree, etc.) to create the charge.

## What to send to the server

From the client, send at least:

- **token** — The full `PaymentToken` object (or the fields your gateway needs). Treat as sensitive.
- **transactionId** — From `PaymentResult.transactionId`, for idempotency or logging.
- **amount** (and currency) — So the server can validate and charge the correct amount.
- Any **order/cart id** — So the server knows what was purchased.

Example:

```ts
const result = await startPayment()
if (result?.success && result.token) {
  await fetch('https://api.yourserver.com/process-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: result.token,
      transactionId: result.transactionId,
      amount: total,
      currency: 'USD',
      orderId: currentOrderId,
    }),
  })
}
```

## Example: Node.js (conceptual, gateway-specific)

Your backend receives the token and calls your gateway SDK/API. The exact request body and field mapping depend on your gateway + tokenization mode. Treat this example as shape guidance, not drop-in code.

```js
// Backend (Node.js example)
app.post('/process-payment', async (req, res) => {
  const { token, amount, currency, orderId } = req.body

  try {
    // 1) Validate order/cart server-side (amount, currency, ownership, status)
    // 2) Choose gateway flow based on platform/gateway config
    //    - iOS (Apple Pay): paymentData is Apple token payload (Base64 string)
    //    - Android (Google Pay): paymentData is Google tokenization payload
    // 3) Call gateway API with the exact fields required by that provider
    // 4) Use idempotency keys and persist payment state

    const charge = await gateway.charge({
      amountMinor: Math.round(amount * 100),
      currency,
      tokenPayload: token.paymentData,
      token: token,
      orderId,
      transactionId: token.transactionIdentifier,
    })

    res.json({ success: true, chargeId: charge.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

**Important:** Use your gateway’s official docs for:

- Mapping `PaymentToken` fields to provider-specific request fields.
- Creating a payment method/source/intent from Apple Pay or Google Pay token payloads.
- Idempotency (e.g. using `transactionId` to avoid duplicate charges).
- Handling failures and refunds.
- Provider-specific walkthroughs in [Przelewy24 Apple Pay + Google Pay cookbook](/docs/integrations/przelewy24).

## Security

- Use **HTTPS** and authenticate the client (e.g. session or API key).
- **Validate amount and currency** on the server; do not trust the client for the charged amount.
- **Do not log** raw token payloads; treat them like card data.
- Prefer creating a **PaymentIntent** (or equivalent) on the server and confirming with the token, so the server controls the amount and idempotency.
