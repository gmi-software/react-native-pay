import type { PaymentRequest, PaymentSheetUpdate } from '../../types'
import {
  normalizePaymentRequest,
  normalizePaymentSheetUpdate,
} from '../paymentRequest'

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

const USD_REQUEST = request([{ label: 'Kit', amount: '10.00', type: 'final' }])

describe('normalizePaymentSheetUpdate', () => {
  it('normalizes the items and shipping methods it has', () => {
    expect(
      normalizePaymentSheetUpdate(
        {
          paymentItems: [
            { label: 'Kit', amount: 10, type: 'final' },
            { label: 'SAVE10', amount: '-1', type: 'final' },
          ],
          shippingMethods: [
            { identifier: 'express', label: 'Express', amount: 7.5 },
          ],
          error: { code: 'couponCodeExpired', message: 'Expired' },
        },
        USD_REQUEST
      )
    ).toEqual({
      paymentItems: [
        { label: 'Kit', amount: '10.00', type: 'final' },
        { label: 'SAVE10', amount: '-1.00', type: 'final' },
      ],
      shippingMethods: [
        { identifier: 'express', label: 'Express', amount: '7.50' },
      ],
      error: { code: 'couponCodeExpired', message: 'Expired' },
    })
  })

  it('keeps an empty update empty', () => {
    expect(normalizePaymentSheetUpdate({}, USD_REQUEST)).toEqual({})
  })

  it.each([
    ['not an object', undefined, 'must resolve with an object, got undefined'],
    ['an array', [], 'must resolve with an object, got an array'],
    [
      'a negative total',
      { paymentItems: [{ label: 'Refund', amount: -5, type: 'final' }] },
      'Payment total must not be negative, got -5.00',
    ],
    [
      'an amount the currency does not allow',
      { paymentItems: [{ label: 'Kit', amount: '10.001', type: 'final' }] },
      'Amount for "Kit" has more than 2 decimal places',
    ],
    ['no shipping methods', { shippingMethods: [] }, 'must not be empty'],
    [
      'an unknown error code',
      { error: { code: 'nope', message: 'Nope' } },
      'error.code must be one of shippingAddressInvalid, shippingAddressUnserviceable, couponCodeInvalid, couponCodeExpired, other, got "nope"',
    ],
    [
      'an error without a message',
      { error: { code: 'other', message: ' ' } },
      'error.message must be a message for the payer',
    ],
    [
      'an unknown item kind',
      {
        paymentItems: [
          { label: 'Kit', amount: 10, type: 'final', kind: 'coupon' },
        ],
      },
      'kind for "Kit" must be one of',
    ],
  ])('rejects %s', (_, update, message) => {
    expect(() =>
      normalizePaymentSheetUpdate(update as PaymentSheetUpdate, USD_REQUEST)
    ).toThrow(message)
  })

  describe('with applePayMultiTokenContexts', () => {
    // As normalizePaymentRequest returns it on iOS: 10.00 + 5.00 shipping.
    const multiMerchant: PaymentRequest = {
      ...USD_REQUEST,
      shippingMethods: [
        { identifier: 'standard', label: 'Standard', amount: '5.00' },
        { identifier: 'pickup', label: 'Pickup', amount: '5.00' },
      ],
      applePayMultiTokenContexts: [
        {
          merchantIdentifier: 'merchant.com.example',
          externalIdentifier: 'shop',
          merchantName: 'Shop',
          amount: '15.00',
        },
      ],
    }

    it('accepts items and methods that keep the total', () => {
      expect(
        normalizePaymentSheetUpdate(
          {
            paymentItems: [
              { label: 'Kit', amount: 12, type: 'final' },
              { label: 'SAVE2', amount: -2, type: 'final', kind: 'discount' },
            ],
            shippingMethods: [
              { identifier: 'courier', label: 'Courier', amount: 5 },
            ],
          },
          multiMerchant
        )
      ).toMatchObject({
        paymentItems: [{ amount: '12.00' }, { amount: '-2.00' }],
      })
    })

    it('rejects items that change the total', () => {
      expect(() =>
        normalizePaymentSheetUpdate(
          {
            paymentItems: [
              { label: 'Kit', amount: 10, type: 'final' },
              { label: 'SAVE2', amount: -2, type: 'final' },
            ],
          },
          multiMerchant
        )
      ).toThrow(
        "With applePayMultiTokenContexts, paymentItems must still add up to 10.00, got 8.00: the total can't change in the sheet"
      )
    })

    it('rejects a shipping method with another price', () => {
      expect(() =>
        normalizePaymentSheetUpdate(
          {
            shippingMethods: [
              { identifier: 'express', label: 'Express', amount: 9 },
            ],
          },
          multiMerchant
        )
      ).toThrow('every shipping method must cost 5.00')
    })

    it('accepts an error alone', () => {
      expect(
        normalizePaymentSheetUpdate(
          { error: { code: 'couponCodeInvalid', message: 'Unknown code' } },
          multiMerchant
        )
      ).toEqual({
        error: { code: 'couponCodeInvalid', message: 'Unknown code' },
      })
    })
  })
})
