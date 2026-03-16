const mockWithGooglePay = jest.fn((config, _props) => ({
  ...config,
  googlePay: true,
}))
const mockWithApplePay = jest.fn((config, _props) => ({
  ...config,
  applePay: true,
}))

jest.mock('../withGooglePay', () => ({
  withGooglePay: (config: any, props: any) => mockWithGooglePay(config, props),
}))

jest.mock('../withApplePay', () => ({
  withApplePay: (config: any, props: any) => mockWithApplePay(config, props),
}))

import withReactNativePay from '../index'

describe('withReactNativePay', () => {
  it('applies Google Pay and Apple Pay plugins in order', () => {
    const inputConfig = { name: 'my-app' }
    const props = {
      merchantIdentifier: 'merchant.com.test',
      enableGooglePay: true,
    }

    const result = withReactNativePay(inputConfig as any, props)

    expect(mockWithGooglePay).toHaveBeenCalledWith(inputConfig, props)
    expect(mockWithApplePay).toHaveBeenCalledWith(
      { name: 'my-app', googlePay: true },
      props
    )
    expect(result).toEqual({ name: 'my-app', googlePay: true, applePay: true })
  })
})
