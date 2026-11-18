import { Platform } from 'react-native'
import type { PaymentRequest, PaymentTokenContext } from '../../types'
import { normalizePaymentRequest } from '../paymentRequest'

const request = (fields: Partial<PaymentRequest>): PaymentRequest => ({
  countryCode: 'US',
  currencyCode: 'USD',
  paymentItems: [
    { label: 'Flight', amount: 150, type: 'final' },
    { label: 'Hotel', amount: 300, type: 'final' },
  ],
  supportedNetworks: ['visa'],
  merchantCapabilities: ['3DS'],
  ...fields,
})

const context = (
  merchantName: string,
  amount: PaymentTokenContext['amount'],
  fields: Partial<PaymentTokenContext> = {}
): PaymentTokenContext => ({
  merchantIdentifier: `merchant.com.example.${merchantName.toLowerCase()}`,
  externalIdentifier: merchantName.toLowerCase(),
  merchantName,
  amount,
  ...fields,
})

const expectInvalid = (fields: Partial<PaymentRequest>, message: string) =>
  expect(() => normalizePaymentRequest(request(fields))).toThrow(message)

describe('normalizePaymentRequest with applePayMultiTokenContexts', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('normalizes the amounts and keeps the other fields', () => {
    const result = normalizePaymentRequest(
      request({
        applePayMultiTokenContexts: [
          context('Airline', 150, { merchantDomain: 'airline.example.com' }),
          context('Hotel', '300'),
        ],
      })
    )

    expect(result.applePayMultiTokenContexts).toEqual([
      {
        merchantIdentifier: 'merchant.com.example.airline',
        externalIdentifier: 'airline',
        merchantName: 'Airline',
        merchantDomain: 'airline.example.com',
        amount: '150.00',
      },
      {
        merchantIdentifier: 'merchant.com.example.hotel',
        externalIdentifier: 'hotel',
        merchantName: 'Hotel',
        amount: '300.00',
      },
    ])
  })

  it('treats an empty list as unset', () => {
    expect(
      normalizePaymentRequest(request({ applePayMultiTokenContexts: [] }))
    ).not.toHaveProperty('applePayMultiTokenContexts')
  })

  it('rejects a list that is not an array, or has an entry that is not an object', () => {
    expectInvalid(
      { applePayMultiTokenContexts: '' as unknown as PaymentTokenContext[] },
      'applePayMultiTokenContexts must be an array'
    )
    // eslint-disable-next-line no-sparse-arrays
    const sparse = [context('Hotel', 450), ,] as PaymentTokenContext[]
    for (const contexts of [
      sparse,
      [context('Hotel', 450), null as unknown as PaymentTokenContext],
    ]) {
      expectInvalid(
        { applePayMultiTokenContexts: contexts },
        'applePayMultiTokenContexts entries must be objects'
      )
    }
  })

  it('removes the contexts on Android without checking them', () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    const result = normalizePaymentRequest(
      request({
        shippingMethods: [
          { identifier: 'express', label: 'Express', amount: 20 },
          { identifier: 'standard', label: 'Standard', amount: 5 },
        ],
        applePayMultiTokenContexts: [context('Hotel', 1)],
      })
    )
    expect(result).not.toHaveProperty('applePayMultiTokenContexts')
    expect(result.shippingMethods).toHaveLength(2)
  })

  it.each([
    ['less', ['150', '299.99'], '449.99'],
    ['more', ['150', '300.01'], '450.01'],
  ])('rejects amounts that add up to %s than the total', (_, amounts, sum) => {
    expectInvalid(
      {
        applePayMultiTokenContexts: amounts.map((amount, index) =>
          context(`Merchant${index}`, amount)
        ),
      },
      `applePayMultiTokenContexts amounts must add up to the total of 450.00, got ${sum}`
    )
  })

  it('adds a shipping method that all methods share to the total', () => {
    const shippingMethods = [
      { identifier: 'express', label: 'Express', amount: 5 },
      { identifier: 'standard', label: 'Standard', amount: '5.00' },
    ]
    expect(() =>
      normalizePaymentRequest(
        request({
          shippingMethods,
          applePayMultiTokenContexts: [
            context('Airline', 150),
            context('Hotel', 305),
          ],
        })
      )
    ).not.toThrow()
    expectInvalid(
      {
        shippingMethods,
        applePayMultiTokenContexts: [
          context('Airline', 150),
          context('Hotel', 300),
        ],
      },
      'applePayMultiTokenContexts amounts must add up to the total of 455.00, got 450.00'
    )
  })

  it('rejects shipping methods that cost different amounts', () => {
    expectInvalid(
      {
        shippingMethods: [
          { identifier: 'express', label: 'Express', amount: 20 },
          { identifier: 'standard', label: 'Standard', amount: 5 },
        ],
        applePayMultiTokenContexts: [context('Hotel', 470)],
      },
      'With applePayMultiTokenContexts, all shipping methods must cost the same: another method would change the total'
    )
  })

  it('rejects an amount that is not positive or not valid', () => {
    expectInvalid(
      { applePayMultiTokenContexts: [context('Hotel', 0)] },
      'Amount for "Hotel" must be positive, got 0.00'
    )
    expectInvalid(
      { applePayMultiTokenContexts: [context('Hotel', '1.234')] },
      'Amount for "Hotel" has more than 2 decimal places'
    )
  })

  it.each([
    'merchantIdentifier',
    'externalIdentifier',
    'merchantName',
    'merchantDomain',
  ] as const)('rejects an empty %s', (field) => {
    expectInvalid(
      {
        applePayMultiTokenContexts: [context('Hotel', 450, { [field]: ' ' })],
      },
      `applePayMultiTokenContexts[].${field} must not be empty`
    )
  })

  it('rejects contexts together with a merchant token request', () => {
    expectInvalid(
      {
        paymentItems: [],
        recurring: {
          description: 'Premium membership',
          managementUrl: 'https://example.com/account',
          regularBilling: {
            label: 'Monthly',
            amount: 9.99,
            intervalUnit: 'month',
          },
        },
        applePayMultiTokenContexts: [context('Hotel', 1)],
      },
      "applePayMultiTokenContexts can't be combined with recurring, deferred or automaticReload"
    )
  })
})
