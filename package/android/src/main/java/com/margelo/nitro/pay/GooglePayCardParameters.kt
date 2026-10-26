package com.margelo.nitro.pay

import org.json.JSONArray
import org.json.JSONObject

/**
 * [PaymentNetwork] values and the Google Pay card networks they stand for
 */
internal object GooglePayNetworks {
    // ELECTRON, MAESTRO and ELO only work for Brazilian combo cards.
    private val googlePayNetworks = mapOf(
        PaymentNetwork.VISA to "VISA",
        PaymentNetwork.MASTERCARD to "MASTERCARD",
        PaymentNetwork.AMEX to "AMEX",
        PaymentNetwork.DISCOVER to "DISCOVER",
        PaymentNetwork.JCB to "JCB",
        PaymentNetwork.INTERAC to "INTERAC",
        PaymentNetwork.ELECTRON to "ELECTRON",
        PaymentNetwork.MAESTRO to "MAESTRO",
        PaymentNetwork.ELO to "ELO"
    )

    /**
     * The network named [name], ignoring case. Same message as iOS.
     *
     * @throws IllegalArgumentException for a name that is not a [PaymentNetwork] value
     */
    fun parse(name: String): PaymentNetwork {
        // Nitro names each entry after its JS value in upper case.
        return PaymentNetwork.entries.firstOrNull {
            it != PaymentNetwork.UNKNOWN && it.name.equals(name, ignoreCase = true)
        } ?: throw IllegalArgumentException(
            "Unknown payment network \"$name\". Use a PaymentNetwork value such as \"visa\" or \"mastercard\""
        )
    }

    /** The Google Pay card network, or null when Google Pay does not offer [network] */
    fun toGooglePay(network: PaymentNetwork): String? = googlePayNetworks[network]

    /** The network of a Google Pay `cardNetwork` value, or UNKNOWN */
    fun fromGooglePay(cardNetwork: String): PaymentNetwork {
        return googlePayNetworks.entries
            .firstOrNull { it.value.equals(cardNetwork, ignoreCase = true) }
            ?.key
            ?: PaymentNetwork.UNKNOWN
    }
}

/**
 * The cards a Google Pay request accepts. The payment request, the readiness
 * check and the button send the same values, so they offer the same cards.
 */
internal data class GooglePayCardParameters(
    val cardNetworks: List<String>,
    val authMethods: List<String>
) {
    /** The `parameters` of a CARD payment method, before any billing address */
    fun toJson(): JSONObject = JSONObject().apply {
        put("allowedAuthMethods", JSONArray(authMethods))
        put("allowedCardNetworks", JSONArray(cardNetworks))
    }

    companion object {
        val DEFAULT_NETWORKS = arrayOf("visa", "mastercard", "amex", "discover")
        private val AUTH_METHODS = listOf(
            PaymentConstants.AUTH_PAN_ONLY,
            PaymentConstants.AUTH_CRYPTOGRAM_3DS
        )

        /**
         * Reads `supportedNetworks` and the allowed auth methods; null uses the
         * defaults. A network Google Pay does not offer is left out.
         *
         * @throws IllegalArgumentException for an unknown value, or when no
         *   network or no auth method is left
         */
        fun from(
            supportedNetworks: Array<String>?,
            authMethods: Array<String>?
        ): GooglePayCardParameters {
            val networkNames = supportedNetworks ?: DEFAULT_NETWORKS
            require(networkNames.isNotEmpty()) { "supportedNetworks needs at least one network" }
            val cardNetworks = networkNames
                .map { GooglePayNetworks.parse(it) }
                .mapNotNull { GooglePayNetworks.toGooglePay(it) }
                .distinct()
            require(cardNetworks.isNotEmpty()) {
                "Google Pay offers none of these networks: ${networkNames.joinToString()}"
            }

            val methods = (authMethods?.toList() ?: AUTH_METHODS).map { method ->
                AUTH_METHODS.firstOrNull { it.equals(method, ignoreCase = true) }
                    ?: throw IllegalArgumentException(
                        "Unknown Google Pay auth method \"$method\". Use \"PAN_ONLY\" or \"CRYPTOGRAM_3DS\""
                    )
            }.distinct()
            require(methods.isNotEmpty()) {
                "Google Pay needs at least one auth method: \"PAN_ONLY\" or \"CRYPTOGRAM_3DS\""
            }

            return GooglePayCardParameters(cardNetworks, methods)
        }
    }
}
