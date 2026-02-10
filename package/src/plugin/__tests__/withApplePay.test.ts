import { withApplePay, setApplePayEntitlement } from '../withApplePay'

const mockWithEntitlementsPlist = jest.fn(
  (config: Record<string, unknown>, action: (input: any) => any) =>
    action({ modResults: config })
)

jest.mock('expo/config-plugins', () => ({
  withEntitlementsPlist: (config: any, action: (input: any) => any) =>
    mockWithEntitlementsPlist(config, action),
}))

describe('withApplePay', () => {
  it('adds a single merchant entitlement', () => {
    const result = setApplePayEntitlement('merchant.com.one', {})
    expect(result).toEqual({
      'com.apple.developer.in-app-payments': ['merchant.com.one'],
    })
  })

  it('adds multiple merchants and de-duplicates existing values', () => {
    const result = setApplePayEntitlement(
      ['merchant.com.a', 'merchant.com.b', 'merchant.com.a', ''],
      {
        'com.apple.developer.in-app-payments': ['merchant.com.a'],
      }
    )
    expect(result).toEqual({
      'com.apple.developer.in-app-payments': [
        'merchant.com.a',
        'merchant.com.b',
      ],
    })
  })

  it('does not modify config when merchantIdentifier is missing', () => {
    const config = { name: 'app' }
    const result = withApplePay(config as any, {})
    expect(result).toBe(config)
    expect(mockWithEntitlementsPlist).not.toHaveBeenCalled()
  })

  it('applies entitlements when merchantIdentifier is provided', () => {
    const config = {}
    const result = withApplePay(config as any, {
      merchantIdentifier: 'merchant.com.test',
    })

    expect(mockWithEntitlementsPlist).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      modResults: {
        'com.apple.developer.in-app-payments': ['merchant.com.test'],
      },
    })
  })
})
