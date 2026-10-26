package com.margelo.nitro.pay

import com.google.android.gms.wallet.PaymentData
import org.json.JSONException
import org.json.JSONObject
import java.util.UUID

/**
 * Mapper for converting between Google Pay and app payment types
 */
object PaymentMapper {
    
    /**
     * Maps Google Pay PaymentData to PaymentResult, with the details that
     * [requested] asked for
     */
    internal fun mapPaymentDataToResult(
        paymentData: PaymentData,
        requested: RequestedDetails = RequestedDetails()
    ): PaymentResult {
        return try {
            val paymentInfo = JSONObject(paymentData.toJson())
            val paymentMethodData = paymentInfo.getJSONObject("paymentMethodData")
            
            // Extract token
            val tokenData = paymentMethodData.getJSONObject("tokenizationData")
            val token = tokenData.getString("token")
            
            // Extract payment method info
            val info = paymentMethodData.getJSONObject("info")
            val cardNetwork = info.optString("cardNetwork", "unknown")
            val cardDetails = info.optString("cardDetails", "****")
            
            // Create payment method. Google Pay asks to show `description`
            // to the payer, not `cardNetwork`.
            val paymentMethod = PaymentMethod(
                displayName = paymentMethodData.optNonEmpty("description")
                    ?: "$cardNetwork $cardDetails",
                network = mapCardNetwork(cardNetwork),
                type = PaymentMethodType.UNKNOWN,
                secureElementPass = null,
                billingAddress = null
            )
            
            // Create payment token
            val paymentToken = PaymentToken(
                paymentMethod = paymentMethod,
                transactionIdentifier = UUID.randomUUID().toString(),
                paymentData = token
            )
            
            val details = mapPaymentDetails(paymentInfo, requested)
            
            // Create successful result
            PaymentResult(
                success = true,
                transactionId = UUID.randomUUID().toString(),
                token = paymentToken,
                error = null,
                billingContact = details.billingContact,
                shippingContact = details.shippingContact,
                emailAddress = details.emailAddress,
                phoneNumber = details.phoneNumber,
                shippingMethod = details.shippingMethod
            )
        } catch (e: JSONException) {
            createErrorResult("Failed to parse payment data: ${e.message}")
        }
    }
    
    /**
     * Reads the requested details from a PaymentData JSON object.
     * The phone number comes from the address it was requested with.
     */
    internal fun mapPaymentDetails(
        paymentData: JSONObject,
        requested: RequestedDetails
    ): PaymentDetails {
        val billingAddress = paymentData.optJSONObject("paymentMethodData")
            ?.optJSONObject("info")
            ?.optJSONObject("billingAddress")
        val shippingAddress = paymentData.optJSONObject("shippingAddress")
        val phoneAddress = if (requested.phoneNumberOnShippingAddress) shippingAddress else billingAddress
        
        return PaymentDetails(
            billingContact = billingAddress?.takeIf { requested.billingContact }?.let(::mapContact),
            shippingContact = shippingAddress?.takeIf { requested.shippingContact }?.let(::mapContact),
            emailAddress = paymentData.takeIf { requested.email }?.optNonEmpty("email"),
            phoneNumber = phoneAddress?.takeIf { requested.phoneNumber }?.optNonEmpty("phoneNumber"),
            shippingMethod = requested.shippingMethod
        )
    }
    
    /**
     * Maps a Google Pay Address object. Google Pay returns the name as one string.
     */
    private fun mapContact(address: JSONObject): PaymentContact {
        val street = listOf("address1", "address2", "address3")
            .mapNotNull { address.optNonEmpty(it) }
            .joinToString("\n")
        
        return PaymentContact(
            name = address.optNonEmpty("name"),
            givenName = null,
            familyName = null,
            postalAddress = CNPostalAddress(
                street = street.ifEmpty { null },
                city = address.optNonEmpty("locality"),
                state = address.optNonEmpty("administrativeArea"),
                postalCode = address.optNonEmpty("postalCode"),
                country = null,
                isoCountryCode = address.optNonEmpty("countryCode")?.uppercase()
            )
        )
    }
    
    /**
     * The trimmed string at [key], or null when it is missing, JSON null or blank
     */
    private fun JSONObject.optNonEmpty(key: String): String? {
        if (isNull(key)) return null
        return optString(key).trim().ifEmpty { null }
    }
    
    /**
     * The contact details of an authorized result, as passed to `onAuthorize`
     */
    fun paymentDetails(result: PaymentResult): PaymentDetails {
        return PaymentDetails(
            billingContact = result.billingContact,
            shippingContact = result.shippingContact,
            emailAddress = result.emailAddress,
            phoneNumber = result.phoneNumber,
            shippingMethod = result.shippingMethod
        )
    }
    
    /**
     * Maps a Google Pay `cardNetwork` value to PaymentNetwork, or UNKNOWN
     */
    fun mapCardNetwork(network: String): PaymentNetwork {
        return GooglePayNetworks.fromGooglePay(network)
    }
    
    /**
     * Applies the merchant's `onAuthorize` outcome to an authorized PaymentResult
     */
    fun applyAuthorization(
        authorization: PaymentAuthorizationResult,
        authorizedResult: PaymentResult
    ): PaymentResult {
        return when (authorization.status) {
            PaymentAuthorizationStatus.SUCCESS -> authorizedResult
            PaymentAuthorizationStatus.FAILURE -> createErrorResult(
                authorization.error ?: PaymentConstants.ERROR_AUTHORIZATION_FAILED
            )
        }
    }
    
    /**
     * Creates an error PaymentResult
     */
    fun createErrorResult(errorMessage: String): PaymentResult {
        return PaymentResult(
            success = false,
            transactionId = null,
            token = null,
            error = errorMessage,
            billingContact = null,
            shippingContact = null,
            emailAddress = null,
            phoneNumber = null,
            shippingMethod = null
        )
    }
}


