import type { PaymentHandler } from './specs/PaymentHandler.nitro'
import type {
  PaymentRequest,
  PaymentResult,
  PaymentSheetSelection,
  PaymentSheetUpdate,
  StartPaymentOptions,
} from './types'
import {
  normalizePaymentRequest,
  normalizePaymentSheetUpdate,
} from './utils/paymentRequest'
import { requireNitro } from './nitro'
import { registerSheetAuthorizationTask } from './sheetAuthorizationTask'

/**
 * Error returned when `startPayment` is called while another payment is
 * still in flight. Matches the message used by the native handlers.
 */
export const PAYMENT_IN_PROGRESS_ERROR = 'A payment is already in progress'

/**
 * Result of `startPayment` while another payment is in flight, as the native
 * handlers return it. Copy it before handing it out.
 */
export const PAYMENT_IN_PROGRESS_RESULT: Readonly<PaymentResult> = {
  status: 'failed',
  code: 'IN_PROGRESS',
  success: false,
  error: PAYMENT_IN_PROGRESS_ERROR,
}

const NATIVE_MODULE_MISSING_ERROR =
  'React Native Pay: the native PaymentHandler is not available. ' +
  'Apple Pay and Google Pay need an iOS or Android build that includes ' +
  '@gmisoftware/react-native-pay and react-native-nitro-modules: rebuild the ' +
  'app after installing them (for Expo, `npx expo prebuild` and a development ' +
  'build; Expo Go is not supported). Web has no native module. In Jest, mock ' +
  'react-native-nitro-modules.'

let paymentHandler: PaymentHandler | undefined

/**
 * Returns the package-wide native `PaymentHandler` instance, created on first
 * use. Its
 * `startPayment` does not validate the request in JS: pass it through
 * `normalizePaymentRequest`, or use `HybridPaymentHandler`.
 *
 * The native in-progress guard lives on the instance, so the hook and the
 * exported `HybridPaymentHandler` must share one.
 *
 * @throws An `Error` naming the fix when the native module is missing.
 */
export function getPaymentHandler(): PaymentHandler {
  if (paymentHandler === undefined) {
    try {
      paymentHandler =
        requireNitro().NitroModules.createHybridObject<PaymentHandler>(
          'PaymentHandler'
        )
    } catch (cause) {
      throw new Error(NATIVE_MODULE_MISSING_ERROR, { cause })
    }
    // Before any onAuthorize reaches native code, on every path to it.
    registerSheetAuthorizationTask()
  }
  return paymentHandler
}

type SheetCallback<Value> = (
  value: Value,
  selection: PaymentSheetSelection
) => Promise<PaymentSheetUpdate>

function checkedSheetCallback<Value>(
  name: string,
  callback: SheetCallback<Value>,
  request: PaymentRequest
): SheetCallback<Value> {
  return async (value, selection) => {
    try {
      return normalizePaymentSheetUpdate(
        await callback(value, selection),
        request
      )
    } catch (err) {
      if (__DEV__) {
        console.warn(
          `[react-native-pay] ${name} failed, so the payment sheet keeps its items: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      throw err
    }
  }
}

/**
 * The options native code gets. Each callback becomes `async`, so a
 * synchronous throw still rejects. What a sheet callback returns is checked
 * with the rules of `request`, as `normalizePaymentRequest` returned it; an invalid update rejects, so the sheet keeps its
 * items, and in development the reason is logged. `undefined` without
 * callbacks.
 */
export function prepareStartPaymentOptions(
  options: StartPaymentOptions | undefined,
  request: PaymentRequest
): StartPaymentOptions | undefined {
  const {
    onAuthorize,
    onShippingAddressChange,
    onShippingMethodChange,
    onPaymentMethodChange,
    onCouponCodeChange,
  } = options ?? {}
  const prepared: StartPaymentOptions = {
    ...(onAuthorize && {
      onAuthorize: async (token, details) => onAuthorize(token, details),
    }),
    ...(onShippingAddressChange && {
      onShippingAddressChange: checkedSheetCallback(
        'onShippingAddressChange',
        onShippingAddressChange,
        request
      ),
    }),
    ...(onShippingMethodChange && {
      onShippingMethodChange: checkedSheetCallback(
        'onShippingMethodChange',
        onShippingMethodChange,
        request
      ),
    }),
    ...(onPaymentMethodChange && {
      onPaymentMethodChange: checkedSheetCallback(
        'onPaymentMethodChange',
        onPaymentMethodChange,
        request
      ),
    }),
    ...(onCouponCodeChange && {
      onCouponCodeChange: checkedSheetCallback(
        'onCouponCodeChange',
        onCouponCodeChange,
        request
      ),
    }),
  }
  return Object.keys(prepared).length > 0 ? prepared : undefined
}

/** The `PaymentHandler` methods that `HybridPaymentHandler` offers. */
export type PaymentHandlerMethods = Pick<
  PaymentHandler,
  | 'payServiceStatus'
  | 'startPayment'
  | 'isPaymentInProgress'
  | 'openPaymentSetup'
>

/**
 * The exported `HybridPaymentHandler`. It delegates to the shared native
 * instance, but `startPayment` first validates the request with
 * `normalizePaymentRequest`, as `usePaymentCheckout` does, and resolves an
 * invalid one with `code: 'CONFIGURATION'` without calling native. Its
 * callbacks go through `prepareStartPaymentOptions`.
 */
export const validatingPaymentHandler: PaymentHandlerMethods = {
  payServiceStatus: (options) => getPaymentHandler().payServiceStatus(options),
  startPayment: async (request, options) => {
    let validatedRequest: PaymentRequest
    try {
      validatedRequest = normalizePaymentRequest(request)
    } catch (err) {
      return {
        status: 'failed',
        code: 'CONFIGURATION',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
    const preparedOptions = prepareStartPaymentOptions(
      options,
      validatedRequest
    )
    return preparedOptions === undefined
      ? getPaymentHandler().startPayment(validatedRequest)
      : getPaymentHandler().startPayment(validatedRequest, preparedOptions)
  },
  isPaymentInProgress: () => getPaymentHandler().isPaymentInProgress(),
  openPaymentSetup: () => getPaymentHandler().openPaymentSetup(),
}
