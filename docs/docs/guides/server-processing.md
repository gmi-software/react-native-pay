# Server-side processing

When the user authorizes a payment, your app receives a **token**. Nothing has been charged yet: your backend must use this token with your payment gateway (Stripe, Braintree, etc.) to create the charge. Send it from [`onAuthorize`](#charge-before-the-sheet-closes), so the payment sheet shows your server's answer.

## What to send to the server

From the client, send at least:

- **token** — The full `PaymentToken` object (or the fields your gateway needs). Treat as sensitive.
- **order/cart id** — So the server knows what was purchased, and as the base of your idempotency key.

Don't send the amount to charge. The server looks up the order and charges the amount and currency it stored. If you also send the total the user saw, the server only compares it with the order and rejects a mismatch.

Don't key idempotency on `token.transactionIdentifier`: it is missing on Android.

The simplest flow sends the token after `startPayment()` resolves. On iOS the sheet has already shown success by then, so don't tell the user the payment succeeded until your server answers, or use [`onAuthorize`](#charge-before-the-sheet-closes) instead:

```ts
import { useEffect } from 'react'
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const order = { id: 'order_123', label: 'Premium plan', total: '49.99' } // your order

function useOrderPayment() {
  const { addItem, clearItems, startPayment } = usePaymentCheckout({
    currencyCode: 'USD',
  })

  // Fill the cart before the user taps pay: startPayment() returns null
  // for an empty cart, and items added in the same handler arrive too late.
  useEffect(() => {
    addItem(order.label, order.total)
    return clearItems
  }, [addItem, clearItems])

  // Pass this to the pay button's onPress.
  return async () => {
    const result = await startPayment()
    if (result?.status === 'success' && result.token) {
      const response = await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: result.token, orderId: order.id }),
      })
      if (!response.ok) throw new Error('Payment processing failed')
    }
  }
}
```

## Charge before the sheet closes

Without `onAuthorize`, Apple Pay shows its success checkmark as soon as the user authorizes, before your server has charged anything. If the charge then fails, the user has already seen "Done".

Pass `onAuthorize` to charge the token while the sheet waits. Resolve with the outcome, and the sheet shows success or failure:

```ts
import { useEffect } from 'react'
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const order = { id: 'order_123', label: 'Premium plan', total: '49.99' } // your order

function useOrderPayment() {
  const { addItem, clearItems, startPayment } = usePaymentCheckout({
    currencyCode: 'USD',
    onAuthorize: async (token) => {
      const response = await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId: order.id }),
      })
      if (!response.ok) {
        const { error } = await response.json()
        return { status: 'failure', error }
      }
      return { status: 'success' }
    },
  })

  useEffect(() => {
    addItem(order.label, order.total)
    return clearItems
  }, [addItem, clearItems])

  return async () => {
    const result = await startPayment()
    // result.status is 'success' only when onAuthorize returned 'success'.
    // The token is already charged, so don't send it to your server again.
  }
}
```

With `HybridPaymentHandler`, pass the same callback as `startPayment(request, { onAuthorize })`.

The second argument of `onAuthorize` holds the contact details and shipping method the request asked for, such as the shipping address. See [Shipping and contact details](/docs/guides/contact-details).

How it behaves:

- **Failure:** `{ status: 'failure', error }` makes the sheet show the failure state. `startPayment` resolves with `status: 'failed'`, `code: 'PROVIDER_ERROR'` and your `error`. A rejected promise is treated the same way.
- **Retries on iOS:** if the user retries from the sheet after a failure or a timeout, `onAuthorize` runs again with the new token. The result reflects the last attempt. A retry can start while a timed-out charge is still running, so key idempotency on your order ID, not on the token.
- **Timeout:** `onAuthorize` must settle within 25 seconds (Apple Pay itself gives up after about 30). Otherwise the payment fails with `code: 'PROVIDER_ERROR'` and "Payment authorization timed out", and the late result is ignored. Your server may still have charged the card, so make the charge idempotent and reconcile by order ID.
- **Android:** Google Pay closes its sheet before it returns the token, and its basic flow has no step that waits for the merchant. `onAuthorize` still runs, with the same timeout, after the sheet closes, and its outcome decides the `PaymentResult`. The same callback works on both platforms.

## Example: Node.js (conceptual, gateway-specific)

Your backend receives the token and calls your gateway SDK/API. The exact request body and field mapping depend on your gateway + tokenization mode. Treat this example as shape guidance, not drop-in code.

```js
// Backend (Node.js example)
app.post('/process-payment', async (req, res) => {
  // Never read the amount to charge from the request body. `total` is only
  // the amount the sheet showed, to compare with the order.
  const { token, orderId, total } = req.body

  try {
    // 1) Load the order server-side and check that it belongs to this user
    //    and is still unpaid.
    // 2) Choose gateway flow based on platform/gateway config
    //    - iOS (Apple Pay): paymentData is Apple token payload (Base64 string)
    //    - Android (Google Pay): paymentData is Google tokenization payload
    // 3) Call gateway API with the exact fields required by that provider
    // 4) Use idempotency keys and persist payment state
    const order = await orders.findForUser(orderId, req.user.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status === 'paid') return res.json({ success: true, chargeId: order.chargeId })
    // The order changed after the app showed it: don't charge an amount the
    // user didn't see. `order.total` is the decimal string, such as '49.99'.
    if (total !== undefined && total !== order.total) {
      return res.status(409).json({ error: 'The order total has changed' })
    }

    const charge = await gateway.charge({
      // Store totals in the currency's minor unit: 2 decimals for USD,
      // 0 for JPY, 3 for KWD. Don't multiply a decimal amount by 100.
      amountMinor: order.totalMinor,
      currency: order.currency,
      tokenPayload: token.paymentData,
      token: token,
      orderId: order.id,
      idempotencyKey: `charge-${order.id}`,
    })

    // Report success only for a completed charge. A decline or a pending
    // charge must not show success in the app. Use your gateway's status value.
    if (charge.status !== 'succeeded') {
      return res.status(402).json({ error: 'The payment was not completed' })
    }
    res.json({ success: true, chargeId: charge.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

**Important:** Use your gateway’s official docs for:

- Mapping `PaymentToken` fields to provider-specific request fields.
- Creating a payment method/source/intent from Apple Pay or Google Pay token payloads.
- Idempotency (e.g. a key derived from your order ID to avoid duplicate charges).
- Handling failures and refunds.
- Provider-specific walkthroughs in [Przelewy24 Apple Pay + Google Pay cookbook](/docs/integrations/przelewy24).

## Security

- Use **HTTPS** and authenticate the client (e.g. session or API key).
- **Take the amount and currency from the server-side order**; never charge an amount the client sent.
- **Do not log** raw token payloads; treat them like card data.
- Prefer creating a **PaymentIntent** (or equivalent) on the server and confirming with the token, so the server controls the amount and idempotency.
