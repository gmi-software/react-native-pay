import { getCurrencyMinorUnits, normalizeAmount } from '../amounts'

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
