# Dynamic cart management

Use the cart API from `usePaymentCheckout` to add, update, and remove items before calling `startPayment()`.

## Add items

**Single item:**

```ts
addItem('Product name', 29.99)
addItem('Discount', -5, 'final')  // negative for discounts
```

**Multiple items:**

```ts
addItems([
  { label: 'Product', amount: 29.99 },
  { label: 'Shipping', amount: 5 },
  { label: 'Tax', amount: 2.8, type: 'final' },
])
```

## Update an item

Change label or amount (or type) by index:

```ts
updateItem(0, { label: 'Product (x2)', amount: 59.98 })
```

## Remove and clear

```ts
removeItem(index)  // remove one item
clearItems()       // empty the cart
```

## Example: quantity and discount

```ts
const { items, addItem, updateItem, removeItem, total } = usePaymentCheckout({ ... })

// Add product with quantity
const handleAddProduct = (name: string, unitPrice: number, quantity: number) => {
  addItem(`${name} (×${quantity})`, unitPrice * quantity)
}

// Apply percentage discount
const handleApplyDiscount = (percent: number) => {
  const discount = -total * (percent / 100)
  addItem('Discount', discount, 'final')
}

// Clear cart
const handleClearCart = () => {
  clearItems()
}
```

## Rules

- **At least one item** is required before `startPayment()`. Otherwise the hook sets an error and returns `null`.
- **total** is derived from `items`; you don’t set it manually.
- Use **type: 'final'** for confirmed amounts (e.g. tax, total); use **'pending'** for estimates (e.g. shipping) if your flow supports it.
