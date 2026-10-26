import {
  CommonNetworks,
  calculateTotal,
  createPaymentItem,
  createPaymentRequest,
  formatAmount,
  formatNetworkName,
  isNetworkSupported,
  parseAmount,
  sanitizePaymentRequest,
} from '../paymentHelpers'

describe('paymentHelpers', () => {
  it('creates payment items with default and explicit type', () => {
    expect(createPaymentItem('Coffee', 4.99)).toEqual({
      label: 'Coffee',
      amount: 4.99,
      type: 'final',
    })
    expect(createPaymentItem('Shipping', 2.5, 'pending')).toEqual({
      label: 'Shipping',
      amount: 2.5,
      type: 'pending',
    })
  })

  it('calculates totals from line items', () => {
    expect(
      calculateTotal([
        createPaymentItem('Product', 10),
        createPaymentItem('Tax', 2.15),
        createPaymentItem('Shipping', 3.35),
      ])
    ).toBeCloseTo(15.5)
  })

  it('calculates totals with exact decimal arithmetic', () => {
    expect(
      calculateTotal([
        createPaymentItem('A', 0.1),
        createPaymentItem('B', '0.2'),
      ])
    ).toBe(0.3)
    expect(
      calculateTotal([
        createPaymentItem('Coffee', 4.99),
        createPaymentItem('Tax', 0.5),
      ])
    ).toBe(5.49)
  })

  it('returns NaN totals for invalid amounts', () => {
    expect(
      calculateTotal([
        createPaymentItem('Coffee', 4.99),
        createPaymentItem('Broken', NaN),
      ])
    ).toBeNaN()
    expect(calculateTotal([createPaymentItem('Broken', 'abc')])).toBeNaN()
  })

  it('creates payment requests with sane defaults', () => {
    const request = createPaymentRequest({
      amount: 19.99,
      label: 'Pro Plan',
    })

    expect(request).toEqual({
      countryCode: 'US',
      currencyCode: 'USD',
      paymentItems: [{ label: 'Pro Plan', amount: '19.99', type: 'final' }],
      supportedNetworks: [
        CommonNetworks.VISA,
        CommonNetworks.MASTERCARD,
        CommonNetworks.AMEX,
        CommonNetworks.DISCOVER,
      ],
      merchantCapabilities: ['3DS'],
    })
  })

  it('allows overriding defaults in payment requests', () => {
    const request = createPaymentRequest({
      amount: 39.99,
      label: 'Deluxe',
      countryCode: 'PL',
      currencyCode: 'PLN',
      supportedNetworks: ['visa'],
      merchantCapabilities: ['EMV'],
      merchantName: 'My Store',
      applePayMerchantIdentifier: 'merchant.com.apple.override',
      googlePayMerchantId: 'google-pay-merchant-id',
    })

    expect(request.countryCode).toBe('PL')
    expect(request.currencyCode).toBe('PLN')
    expect(request.supportedNetworks).toEqual(['visa'])
    expect(request.merchantCapabilities).toEqual(['EMV'])
    expect(request.merchantName).toBe('My Store')
    expect(request.applePayMerchantIdentifier).toBe(
      'merchant.com.apple.override'
    )
    expect(request.googlePayMerchantId).toBe('google-pay-merchant-id')
  })

  it('types merchant capabilities as the values iOS accepts', () => {
    // iOS fails the payment for an unknown value; JS passes it through.
    const request = createPaymentRequest({
      amount: 1,
      label: 'Order',
      // @ts-expect-error 'Unknown' is not a MerchantCapability
      merchantCapabilities: ['Unknown'],
    })

    expect(request.merchantCapabilities).toEqual(['Unknown'])
  })

  it('rejects invalid amounts in created payment requests', () => {
    expect(() => createPaymentRequest({ amount: NaN, label: 'Order' })).toThrow(
      'finite number or a decimal string'
    )
    expect(() => createPaymentRequest({ amount: -1, label: 'Order' })).toThrow(
      'must not be negative'
    )
    expect(() =>
      createPaymentRequest({ amount: 1.005, label: 'Order' })
    ).toThrow('more than 2 decimal places')
  })

  it('omits undefined optional fields from created payment requests', () => {
    const request = createPaymentRequest({
      amount: 10,
      label: 'Order',
      merchantName: undefined,
      googlePayMerchantId: undefined,
      googlePayGateway: 'stripe',
    })

    expect(request).not.toHaveProperty('merchantName')
    expect(request).not.toHaveProperty('googlePayMerchantId')
    expect(request.googlePayGateway).toBe('stripe')
  })

  it('sanitizes payment requests before native bridging', () => {
    const request = sanitizePaymentRequest({
      countryCode: 'PL',
      currencyCode: 'PLN',
      paymentItems: [{ label: 'Order', amount: 10, type: 'final' }],
      supportedNetworks: ['visa'],
      merchantCapabilities: ['3DS'],
      merchantName: undefined,
      googlePayGateway: 'przelewy24',
      googlePayGatewayMerchantId: undefined,
    } as any)

    expect(request).not.toHaveProperty('merchantName')
    expect(request).not.toHaveProperty('googlePayGatewayMerchantId')
    expect(request.googlePayGateway).toBe('przelewy24')
  })

  it('formats and parses amount values', () => {
    expect(formatAmount(29.9)).toBe('29.90')
    expect(parseAmount('29.90')).toBeCloseTo(29.9)
  })

  it('formats string amounts with currency precision', () => {
    expect(formatAmount('100')).toBe('100.00')
    expect(formatAmount(1.005)).toBe('1.01')
    expect(formatAmount('-1.005')).toBe('-1.01')
    expect(formatAmount('1.004')).toBe('1.00')
    expect(formatAmount(1500, 'JPY')).toBe('1500')
    expect(formatAmount('1.2345', 'KWD')).toBe('1.235')
    expect(formatAmount(NaN)).toBe('NaN')
  })

  it('checks network support using case-insensitive matching', () => {
    expect(isNetworkSupported('AMEX', ['visa', 'amex'])).toBe(true)
    expect(isNetworkSupported('discover', ['visa', 'mastercard'])).toBe(false)
  })

  it('formats known payment networks for display', () => {
    expect(formatNetworkName('visa')).toBe('Visa')
    expect(formatNetworkName('amex')).toBe('American Express')
    expect(formatNetworkName('privateLabel')).toBe('Private Label')
    expect(formatNetworkName('cartesBancaires')).toBe('Cartes Bancaires')
    expect(formatNetworkName('unknown')).toBe('Unknown')
  })
})
