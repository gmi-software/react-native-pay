# Dynamic cart management

Use the cart API from `usePaymentCheckout` to add, update, and remove items before calling `startPayment()`.

## Add items

**Single item:**

```ts no-check
addItem('Product name', 29.99)
addItem('Discount', -5, 'final')  // negative for discounts
```

**Multiple items:**

```ts no-check
addItems([
  { label: 'Product', amount: 29.99 },
  { label: 'Shipping', amount: 5 },
  { label: 'Tax', amount: 2.8, type: 'final' },
])
```

## Update an item

Change label or amount (or type) by index:

```ts no-check
updateItem(0, { label: 'Product (x2)', amount: 59.98 })
```

## Remove and clear

```ts no-check
removeItem(index)  // remove one item
clearItems()       // empty the cart
```

## Example: quantity and discount

```ts
import { formatAmount, usePaymentCheckout } from '@gmisoftware/react-native-pay'

const { addItem, clearItems, total } = usePaymentCheckout({
  merchantName: 'Your Store',
  countryCode: 'US',
  currencyCode: 'USD',
})

// Add product with quantity
const handleAddProduct = (name: string, unitPrice: number, quantity: number) => {
  // 1.1 * 3 is 3.3000000000000003; round it to the currency's decimals
  addItem(`${name} (×${quantity})`, formatAmount(unitPrice * quantity))
}

// Apply percentage discount (a negative line item)
const handleApplyDiscount = (percent: number) => {
  addItem('Discount', formatAmount(-total * (percent / 100)), 'final')
}

// Clear cart
const handleClearCart = () => {
  clearItems()
}
```

## Rules

- **At least one item** is required before `startPayment()`. Otherwise the hook sets an error and returns `null`.
- **total** is derived from `items`; you don’t set it manually. It is an exact decimal sum.
- **Round computed amounts** with `formatAmount(value, currencyCode)`. `startPayment()` rejects amounts with more decimal places than the currency allows, which includes unrounded float results such as `1.1 * 3`. See [`PaymentAmount`](/docs/api/types#paymentamount).
- **Discounts** can be negative line items, as long as the total is not negative.
- Use **type: 'final'** for confirmed amounts (e.g. product price, tax); use **'pending'** for estimates (e.g. shipping) if your flow supports it.
- **One pending item makes the total an estimate.** Google Pay shows the total as estimated (`totalPriceStatus: 'ESTIMATED'`) and Apple Pay marks the total as pending. An estimate does not let you charge a different amount: Google Pay requires the amount you authorize and charge to match the `totalPrice` shown on the sheet, and a mismatch can be declined. If the final amount differs from the estimate, start a new payment with the final amount, unless your gateway explicitly supports adjusting it (for example, incremental authorization).

## Update the cart in the sheet

While the Apple Pay sheet is open, the payer can pick another shipping address, shipping method or card, and enter a coupon code. Pass callbacks to update the cart when they do: tax by region, an address you don't deliver to, a fee for credit cards, a discount code. They go in the [`usePaymentCheckout`](/docs/api/use-payment-checkout#configuration) config or in the second argument of `HybridPaymentHandler.startPayment()`.

**iOS only for now.** Android ignores these callbacks until Google Pay's payment data callbacks are supported ([#72](https://github.com/gmi-software/react-native-pay/issues/72)), so check the address in `onAuthorize` there. Google Pay has no coupon field.

```ts
import {
  HybridPaymentHandler,
  type PaymentItem,
  type PaymentSheetSelection,
} from '@gmisoftware/react-native-pay'

// The whole cart from what the payer chose so far. Every callback calls it,
// so the discount stays when the address changes.
function cart(selection: PaymentSheetSelection): PaymentItem[] {
  const items: PaymentItem[] = [
    { label: 'Sneakers', amount: '40.00', type: 'final' },
  ]
  if (selection.couponCode === 'SAVE10') {
    items.push({ label: 'SAVE10', amount: '-4.00', type: 'final' })
  }
  if (selection.shippingAddress?.administrativeArea === 'CA') {
    items.push({ label: 'Sales tax', amount: '2.61', type: 'final' })
  }
  return items
}

export async function checkout() {
  return HybridPaymentHandler.startPayment(
    {
      merchantName: 'Your Store',
      countryCode: 'US',
      currencyCode: 'USD',
      merchantCapabilities: ['3DS'],
      supportedNetworks: ['visa', 'mastercard'],
      paymentItems: cart({}),
      shippingContactRequired: true,
      shippingMethods: [
        { identifier: 'standard', label: 'Standard', amount: '0.00' },
        { identifier: 'express', label: 'Express', amount: '9.00' },
      ],
    },
    {
      onShippingAddressChange: async (address, selection) => ({
        paymentItems: cart(selection),
        ...(address.countryCode !== 'US' && {
          error: {
            code: 'shippingAddressUnserviceable',
            message: 'We only ship within the US.',
          },
        }),
      }),
      onCouponCodeChange: async (code, selection) =>
        code === '' || code === 'SAVE10'
          ? { paymentItems: cart(selection) }
          : { error: { code: 'couponCodeInvalid', message: 'Unknown code.' } },
    }
  )
}
```

- **One cart from `selection`.** Each callback gets the change and a [`PaymentSheetSelection`](/docs/api/types#payment-sheet-updates): the address, shipping method, card and accepted coupon code chosen so far, including this change. Compute the whole cart from it, as above, so one change doesn't undo another.
- **Return payment items only.** The library adds the selected shipping method, later charges and the total, as for `PaymentRequest`, and checks the amounts with the same rules. A field you leave out stays as it is.
- **The address is redacted** until the payer authorizes: country, state, city and postal code (only its start in the UK and Canada), without street, name, email or phone. `onShippingAddressChange` needs `shippingContactRequired`. The full address comes in `onAuthorize`.
- **Shipping methods.** Without `onShippingMethodChange`, the library adds the new method's amount to the current items. Return `shippingMethods` from any callback to change the list: the selected method stays selected while it is in the list, otherwise the first one is. An empty list is invalid. On iOS an `error` from `onShippingMethodChange` isn't shown, because Apple Pay has none for that change.
- **The card** comes as a [`PaymentSheetCard`](/docs/api/types#payment-sheet-updates). Its `type` can be `'unknown'` and its `network` missing, as with the simulator's card, so don't rely on them alone for a fee.
- **Errors.** An `error` keeps the payer from paying until they change what it refers to: `shippingAddressInvalid`, `shippingAddressUnserviceable`, `couponCodeInvalid`, `couponCodeExpired` or `other`. Its `message` is shown to them.
- **Coupon codes.** The coupon field appears only with `onCouponCodeChange`. A cleared field calls it with `''`. Pass `couponCode` in the request for a code already applied. The last code accepted without an error is `details.couponCode` in `onAuthorize` and `result.couponCode`. Apple Pay doesn't put it in the token, so check the code again on your server and charge the discount for it there.
- **Several merchants.** With [`applePayMultiTokenContexts`](/docs/api/types#several-merchants), PassKit needs the total to stay equal to the contexts' sum. An update may change the items and the shipping methods, but they must add up to the same total and every method must cost the same as before; otherwise the sheet keeps its items. An `error` alone always applies.
- **25 seconds.** Each callback must settle within 25 seconds, like `onAuthorize`. If it rejects, times out or returns an invalid update, the sheet keeps its current items and shows no error; a rejection or an invalid update is logged in development.
- **The hook's `items` don't change.** With `usePaymentCheckout`, updates change only the sheet, so a coupon the payer tried and then cancelled leaves no discount in your cart.
