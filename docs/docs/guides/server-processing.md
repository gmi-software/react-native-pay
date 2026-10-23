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
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const { startPayment, total } = usePaymentCheckout({ currencyCode: 'USD' })
const currentOrderId = 'order_123' // your order ID

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

## Charge before the sheet closes

Without `onAuthorize`, Apple Pay shows its success checkmark as soon as the user authorizes, before your server has charged anything. If the charge then fails, the user has already seen "Done".

Pass `onAuthorize` to charge the token while the sheet waits. Resolve with the outcome, and the sheet shows success or failure:

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const order = { id: 'order_123', total: '49.99' } // your order

const { startPayment } = usePaymentCheckout({
  currencyCode: 'USD',
  onAuthorize: async (token) => {
    const response = await fetch('https://api.yourserver.com/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, amount: order.total, currency: 'USD', orderId: order.id }),
    })
    if (!response.ok) {
      const { error } = await response.json()
      return { status: 'failure', error }
    }
    return { status: 'success' }
  },
})

const result = await startPayment()
// result.success is true only when onAuthorize returned 'success'.
// The token is already charged, so don't send it to your server again.
```

With `HybridPaymentHandler`, pass the same callback as `startPayment(request, { onAuthorize })`.

How it behaves:

- **Failure:** `{ status: 'failure', error }` makes the sheet show the failure state. `startPayment` resolves with `success: false` and your `error`. A rejected promise is treated the same way.
- **Retries on iOS:** if the user retries from the sheet after a failure or a timeout, `onAuthorize` runs again with the new token. The result reflects the last attempt. A retry can start while a timed-out charge is still running, so key idempotency on your order ID, not on the token.
- **Timeout:** `onAuthorize` must settle within 25 seconds (Apple Pay itself gives up after about 30). Otherwise the payment fails with "Payment authorization timed out" and the late result is ignored. Your server may still have charged the card, so make the charge idempotent and reconcile by order ID.
- **Android:** Google Pay closes its sheet before it returns the token, and its basic flow has no step that waits for the merchant. `onAuthorize` still runs, with the same timeout, after the sheet closes, and its outcome decides the `PaymentResult`. The same callback works on both platforms.

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
