import type {
  GooglePayAuthMethod,
  MerchantCapability,
  PaymentNetwork,
} from '../types'

/**
 * Every `PaymentNetwork` a request may name, and whether Google Pay offers
 * it. Keyed by the union, so a new network fails typecheck until it is added.
 */
const PAYMENT_NETWORKS = {
  visa: true,
  mastercard: true,
  amex: true,
  discover: true,
  jcb: true,
  interac: true,
  electron: true,
  maestro: true,
  elo: true,
  idcredit: false,
  privateLabel: false,
  cartesBancaires: false,
  chinaUnionPay: false,
  dankort: false,
  eftpos: false,
  girocard: false,
  mada: false,
  mir: false,
  quicPay: false,
  suica: false,
  vPay: false,
  waon: false,
  nanaco: false,
  bancontact: false,
  postFinance: false,
  pagoBancomat: false,
  tmoney: false,
  meeza: false,
  napas: false,
  bankAxept: false,
  himyan: false,
  jaywan: false,
  myDebit: false,
} satisfies Record<Exclude<PaymentNetwork, 'unknown'>, boolean>

const AUTH_METHODS: GooglePayAuthMethod[] = ['PAN_ONLY', 'CRYPTOGRAM_3DS']

const MERCHANT_CAPABILITIES: MerchantCapability[] = [
  '3DS',
  'EMV',
  'Credit',
  'Debit',
]

function findIgnoringCase<T extends string>(
  values: readonly T[],
  value: string
): T | undefined {
  return values.find((entry) => entry.toLowerCase() === value.toLowerCase())
}

/**
 * Checks the card props of `GooglePayButton` with the rules Android applies
 * to them and to a payment request. Returns what is wrong, or null.
 */
export function googlePayButtonConfigError({
  supportedNetworks,
  googlePayAllowedAuthMethods,
  merchantCapabilities,
}: {
  supportedNetworks?: string[]
  googlePayAllowedAuthMethods?: string[]
  merchantCapabilities?: string[]
}): string | null {
  if (supportedNetworks !== undefined) {
    if (supportedNetworks.length === 0) {
      return 'supportedNetworks needs at least one network'
    }
    const names = Object.keys(PAYMENT_NETWORKS) as Array<
      keyof typeof PAYMENT_NETWORKS
    >
    const networks: Array<keyof typeof PAYMENT_NETWORKS> = []
    for (const name of supportedNetworks) {
      const network = findIgnoringCase(names, name)
      if (network === undefined) {
        return `Unknown payment network "${name}". Use a PaymentNetwork value such as "visa" or "mastercard"`
      }
      networks.push(network)
    }
    if (!networks.some((network) => PAYMENT_NETWORKS[network])) {
      return `Google Pay offers none of these networks: ${supportedNetworks.join(', ')}`
    }
  }

  if (googlePayAllowedAuthMethods !== undefined) {
    if (googlePayAllowedAuthMethods.length === 0) {
      return 'Google Pay needs at least one auth method: "PAN_ONLY" or "CRYPTOGRAM_3DS"'
    }
    const unknown = googlePayAllowedAuthMethods.find(
      (method) => findIgnoringCase(AUTH_METHODS, method) === undefined
    )
    if (unknown !== undefined) {
      return `Unknown Google Pay auth method "${unknown}". Use "PAN_ONLY" or "CRYPTOGRAM_3DS"`
    }
  }

  const unknownCapability = merchantCapabilities?.find(
    (capability) =>
      findIgnoringCase(MERCHANT_CAPABILITIES, capability) === undefined
  )
  if (unknownCapability !== undefined) {
    return `Unknown merchant capability "${unknownCapability}". Use "3DS", "EMV", "Credit" or "Debit"`
  }

  return null
}
