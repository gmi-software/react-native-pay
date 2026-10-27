import type { ConfigPlugin } from 'expo/config-plugins'
import type { ReactNativePayPluginProps } from './type'
import { withApplePay } from './withApplePay'
import { withGooglePay } from './withGooglePay'

const withReactNativePay: ConfigPlugin<ReactNativePayPluginProps | void> = (
  config,
  props
) => {
  const options = props ?? {}

  config = withGooglePay(config, options)

  config = withApplePay(config, options)

  return config
}

export default withReactNativePay
