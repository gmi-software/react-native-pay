import type { ConfigPlugin } from 'expo/config-plugins'
import type { ReactNativePayPluginProps } from './type'
import { withApplePay } from './withApplePay'
import { withGooglePay } from './withGooglePay'

const withReactNativePay: ConfigPlugin<ReactNativePayPluginProps> = (
  config,
  props
) => {
  config = withGooglePay(config, props)

  config = withApplePay(config, props)

  return config
}

export default withReactNativePay
