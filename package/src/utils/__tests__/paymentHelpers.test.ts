import {
  CommonNetworks,
  calculateTotal,
  createPaymentItem,
  createPaymentRequest,
  formatAmount,
  formatNetworkName,
  isNetworkSupported,
  parseAmount,
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

  it('creates payment requests with sane defaults', () => {
    const request = createPaymentRequest({
      amount: 19.99,
      label: 'Pro Plan',
    })

    expect(request).toEqual({
      countryCode: 'US',
      currencyCode: 'USD',
      paymentItems: [{ label: 'Pro Plan', amount: 19.99, type: 'final' }],
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

  it('formats and parses amount values', () => {
    expect(formatAmount(29.9)).toBe('29.90')
    expect(parseAmount('29.90')).toBeCloseTo(29.9)
  })

  it('checks network support using case-insensitive matching', () => {
    expect(isNetworkSupported('AMEX', ['visa', 'amex'])).toBe(true)
    expect(isNetworkSupported('discover', ['visa', 'mastercard'])).toBe(false)
  })

  it('formats known payment networks for display', () => {
    expect(formatNetworkName('visa')).toBe('Visa')
    expect(formatNetworkName('amex')).toBe('American Express')
    expect(formatNetworkName('privateLabel')).toBe('Private Label')
  })
})
