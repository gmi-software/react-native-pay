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
