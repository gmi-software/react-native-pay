import React from 'react'
import { Platform } from 'react-native'
import { render, screen } from '@testing-library/react-native'

// The host components become plain host elements, so their props can be read.
jest.mock('react-native-nitro-modules', () => ({
  getHostComponent: (name: string) => name,
  callback: (func: unknown) => ({ f: func }),
}))

import { ApplePayButton } from '../ApplePayButton'
import { GooglePayButton } from '../GooglePayButton'

/** Taps the native button the way Nitro does: through the wrapped `onPress`. */
function tap(testID: string) {
  screen.getByTestId(testID).props.onPress.f()
}

describe('ApplePayButton', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('passes a plain onPress to the native button', () => {
    const onPress = jest.fn()
    render(
      <ApplePayButton
        testID="pay"
        buttonType="buy"
        buttonStyle="black"
        style={{ height: 48 }}
        onPress={onPress}
      />
    )

    const button = screen.getByTestId('pay')
    expect(button.type).toBe('ApplePayButton')
    expect(button.props).toMatchObject({
      buttonType: 'buy',
      buttonStyle: 'black',
      style: { height: 48 },
    })
    expect(button.props).not.toHaveProperty('disabled')

    tap('pay')
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('keeps the native onPress when only the handler changes', () => {
    const first = jest.fn()
    const second = jest.fn()
    const { rerender } = render(
      <ApplePayButton
        testID="pay"
        buttonType="buy"
        buttonStyle="black"
        onPress={first}
      />
    )
    const nativeOnPress = screen.getByTestId('pay').props.onPress

    rerender(
      <ApplePayButton
        testID="pay"
        buttonType="buy"
        buttonStyle="black"
        onPress={second}
      />
    )

    expect(screen.getByTestId('pay').props.onPress).toBe(nativeOnPress)
    tap('pay')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('ignores taps while disabled', () => {
    const onPress = jest.fn()
    const { rerender } = render(
      <ApplePayButton
        testID="pay"
        buttonType="buy"
        buttonStyle="black"
        onPress={onPress}
        disabled
      />
    )
    const nativeOnPress = screen.getByTestId('pay').props.onPress

    tap('pay')
    expect(onPress).not.toHaveBeenCalled()

    rerender(
      <ApplePayButton
        testID="pay"
        buttonType="buy"
        buttonStyle="black"
        onPress={onPress}
        disabled={false}
      />
    )
    expect(screen.getByTestId('pay').props.onPress).toBe(nativeOnPress)
    tap('pay')
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does nothing on tap without onPress', () => {
    render(<ApplePayButton testID="pay" buttonType="buy" buttonStyle="black" />)

    expect(() => tap('pay')).not.toThrow()
  })

  it('still accepts onPress wrapped with callback(), with a warning', () => {
    const onPress = jest.fn()
    const wrapped = { f: onPress } as unknown as () => void
    render(
      <ApplePayButton
        testID="pay"
        buttonType="buy"
        buttonStyle="black"
        onPress={wrapped}
      />
    )

    tap('pay')
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('no longer needs callback()')
  })

  it('renders nothing on Android, with a warning', () => {
    jest.replaceProperty(Platform, 'OS', 'android')

    const { toJSON } = render(
      <ApplePayButton
        buttonType="buy"
        buttonStyle="black"
        onPress={jest.fn()}
      />
    )

    expect(toJSON()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('ApplePayButton is iOS-only')
  })
})

describe('GooglePayButton', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android')
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('passes its props and a plain onPress to the native button', () => {
    const onPress = jest.fn()
    render(
      <GooglePayButton
        testID="pay"
        buttonType="pay"
        theme="light"
        radius={8}
        supportedNetworks={['visa']}
        googlePayAllowedAuthMethods={['CRYPTOGRAM_3DS']}
        merchantCapabilities={['Debit']}
        onPress={onPress}
      />
    )

    const button = screen.getByTestId('pay')
    expect(button.type).toBe('GooglePayButton')
    expect(button.props).toMatchObject({
      buttonType: 'pay',
      theme: 'light',
      radius: 8,
      supportedNetworks: ['visa'],
      googlePayAllowedAuthMethods: ['CRYPTOGRAM_3DS'],
      merchantCapabilities: ['Debit'],
    })

    tap('pay')
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('keeps the native onPress and ignores taps while disabled', () => {
    const first = jest.fn()
    const second = jest.fn()
    const { rerender } = render(
      <GooglePayButton
        testID="pay"
        buttonType="buy"
        theme="dark"
        onPress={first}
        disabled
      />
    )
    const nativeOnPress = screen.getByTestId('pay').props.onPress

    tap('pay')
    rerender(
      <GooglePayButton
        testID="pay"
        buttonType="buy"
        theme="dark"
        onPress={second}
      />
    )
    tap('pay')

    expect(screen.getByTestId('pay').props.onPress).toBe(nativeOnPress)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('renders nothing on iOS, with a warning', () => {
    jest.replaceProperty(Platform, 'OS', 'ios')

    const { toJSON } = render(
      <GooglePayButton buttonType="buy" theme="dark" onPress={jest.fn()} />
    )

    expect(toJSON()).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('GooglePayButton is Android-only')
  })
})
