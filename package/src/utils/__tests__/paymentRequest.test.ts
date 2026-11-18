import type { PaymentRequest } from '../../types'
import { normalizePaymentRequest } from '../paymentRequest'

const request = (
  paymentItems: PaymentRequest['paymentItems'],
  currencyCode = 'USD'
): PaymentRequest => ({
  countryCode: 'US',
  currencyCode,
  paymentItems,
  supportedNetworks: ['visa'],
  merchantCapabilities: ['3DS'],
})

describe('normalizePaymentRequest', () => {
  it('converts every item to an exact decimal string', () => {
    const normalized = normalizePaymentRequest(
      request([
        { label: 'Coffee', amount: 4.99, type: 'final' },
        { label: 'Tip', amount: '0.5', type: 'pending' },
      ])
    )

    expect(normalized.paymentItems).toEqual([
      { label: 'Coffee', amount: '4.99', type: 'final' },
      { label: 'Tip', amount: '0.50', type: 'pending' },
    ])
  })

  it('allows negative line items when the total is not negative', () => {
    const normalized = normalizePaymentRequest(
      request([
        { label: 'Product', amount: 10, type: 'final' },
        { label: 'Discount', amount: -10, type: 'final' },
      ])
    )

    expect(normalized.paymentItems.map((item) => item.amount)).toEqual([
      '10.00',
      '-10.00',
    ])
  })

  it('keeps item kinds and the total label', () => {
    const normalized = normalizePaymentRequest({
      ...request([
        { label: 'Subtotal', amount: 10, type: 'final', kind: 'subtotal' },
        { label: 'Coupon', amount: -2, type: 'final', kind: 'discount' },
        { label: 'VAT', amount: '1.84', type: 'final', kind: 'tax' },
      ]),
      totalLabel: 'Razem',
    })

    expect(normalized.totalLabel).toBe('Razem')
    expect(normalized.paymentItems.map((item) => item.kind)).toEqual([
      'subtotal',
      'discount',
      'tax',
    ])
  })

  it('rejects an unknown item kind', () => {
    expect(() =>
      normalizePaymentRequest(
        request([
          { label: 'VAT', amount: 1, type: 'final', kind: 'TAX' as 'tax' },
        ])
      )
    ).toThrow(
      'kind for "VAT" must be one of "subtotal", "tax", "discount", got "TAX"'
    )
  })

  it.each(['', '   ', 42])('rejects the total label %p', (totalLabel) => {
    expect(() =>
      normalizePaymentRequest({
        ...request([{ label: 'Coffee', amount: 1, type: 'final' }]),
        totalLabel: totalLabel as string,
      })
    ).toThrow('totalLabel must be a non-empty string')
  })

  it('rejects a negative total', () => {
    expect(() =>
      normalizePaymentRequest(
        request([
          { label: 'Product', amount: '10', type: 'final' },
          { label: 'Discount', amount: '-10.01', type: 'final' },
        ])
      )
    ).toThrow('Payment total must not be negative, got -0.01')
  })

  it.each(['usd', 'US', 'USDD', ''])(
    'rejects the currency code %p',
    (currencyCode) => {
      expect(() =>
        normalizePaymentRequest(
          request(
            [{ label: 'Product', amount: 10, type: 'final' }],
            currencyCode
          )
        )
      ).toThrow(
        `currencyCode must be an upper-case code like "USD", got "${currencyCode}"`
      )
    }
  )

  it.each(['USA', 'us', 'U', ''])(
    'rejects the country code %p',
    (countryCode) => {
      expect(() =>
        normalizePaymentRequest({
          ...request([{ label: 'Product', amount: 10, type: 'final' }]),
          countryCode,
        })
      ).toThrow(
        `countryCode must be an upper-case code like "US", got "${countryCode}"`
      )
    }
  )

  it('normalizes shipping methods', () => {
    const normalized = normalizePaymentRequest({
      ...request([{ label: 'Product', amount: 10, type: 'final' }]),
      shippingMethods: [
        {
          identifier: 'express',
          label: 'Express',
          amount: 7.5,
          detail: '1 day',
        },
      ],
    })

    expect(normalized.shippingMethods).toEqual([
      {
        identifier: 'express',
        label: 'Express',
        amount: '7.50',
        detail: '1 day',
      },
    ])
  })

  it('does not modify the input request', () => {
    const input = request([{ label: 'Product', amount: 10, type: 'final' }])

    normalizePaymentRequest(input)

    expect(input.paymentItems[0]?.amount).toBe(10)
  })
})
