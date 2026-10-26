import type { PaymentRequest } from '../../types'
import {
  getCurrencyMinorUnits,
  normalizeAmount,
  normalizePaymentRequest,
} from '../amounts'

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

describe('getCurrencyMinorUnits', () => {
  it('follows ISO 4217 and defaults to 2', () => {
    expect(getCurrencyMinorUnits('USD')).toBe(2)
    expect(getCurrencyMinorUnits('jpy')).toBe(0)
    expect(getCurrencyMinorUnits('KWD')).toBe(3)
    expect(getCurrencyMinorUnits('CLF')).toBe(4)
    expect(getCurrencyMinorUnits('XYZ')).toBe(2)
  })
})

describe('normalizeAmount', () => {
  it.each([
    [19.99, 'USD', '19.99'],
    ['19.99', 'USD', '19.99'],
    [19.9, 'USD', '19.90'],
    [10, 'USD', '10.00'],
    ['1234.56', 'USD', '1234.56'],
    ['1.500', 'USD', '1.50'],
    ['-5', 'USD', '-5.00'],
    ['-0.00', 'USD', '0.00'],
    [0, 'USD', '0.00'],
    [1500, 'JPY', '1500'],
    ['1500.00', 'JPY', '1500'],
    ['1.234', 'KWD', '1.234'],
    [1.2, 'KWD', '1.200'],
    ['90071992547409.99', 'USD', '90071992547409.99'],
  ])('normalizes %p in %s to %p', (amount, currencyCode, expected) => {
    expect(normalizeAmount(amount, currencyCode)).toBe(expected)
  })

  it.each([
    [NaN],
    [Infinity],
    [-Infinity],
    [1e21],
    [1e-7],
    [''],
    [' 1.00'],
    ['1,00'],
    ['1.'],
    ['.5'],
    ['+1'],
    ['1e3'],
    ['NaN'],
    [null as unknown as number],
  ])('rejects malformed amount %p', (amount) => {
    expect(() => normalizeAmount(amount, 'USD')).toThrow(
      'must be a finite number or a decimal string'
    )
  })

  it.each([
    [1.005, 'USD'],
    ['19.999', 'USD'],
    [0.1 + 0.2, 'USD'],
    ['1.5', 'JPY'],
    ['1.2345', 'KWD'],
  ])('rejects %p as too precise for %s', (amount, currencyCode) => {
    expect(() => normalizeAmount(amount, currencyCode)).toThrow(
      'decimal places'
    )
  })

  it('names the item in error messages', () => {
    expect(() => normalizeAmount(1.005, 'USD', 'Coffee')).toThrow(
      'Amount for "Coffee" has more than 2 decimal places, which USD allows, got 1.005'
    )
  })
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
