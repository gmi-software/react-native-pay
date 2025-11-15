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
     * Maps Google Pay PaymentData to PaymentResult
     */
    fun mapPaymentDataToResult(paymentData: PaymentData): PaymentResult {
        return try {
            val paymentInfo = paymentData.toJson()
            val paymentMethodData = JSONObject(paymentInfo).getJSONObject("paymentMethodData")
            
            // Extract token
            val tokenData = paymentMethodData.getJSONObject("tokenizationData")
            val token = tokenData.getString("token")
            
            // Extract payment method info
            val info = paymentMethodData.getJSONObject("info")
            val cardNetwork = info.optString("cardNetwork", "unknown")
            val cardDetails = info.optString("cardDetails", "****")
            
            // Create payment method
            val paymentMethod = PaymentMethod(
                displayName = "$cardNetwork $cardDetails",
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
            
            // Create successful result
            PaymentResult(
                success = true,
                transactionId = UUID.randomUUID().toString(),
                token = paymentToken,
                error = null
            )
        } catch (e: JSONException) {
            createErrorResult("Failed to parse payment data: ${e.message}")
        }
    }
    
    /**
     * Maps card network string to PaymentNetwork enum
     */
    fun mapCardNetwork(network: String): PaymentNetwork {
        return when (network.uppercase()) {
            "VISA" -> PaymentNetwork.VISA
            "MASTERCARD" -> PaymentNetwork.MASTERCARD
            "AMEX" -> PaymentNetwork.AMEX
            "DISCOVER" -> PaymentNetwork.DISCOVER
            "JCB" -> PaymentNetwork.JCB
            "MAESTRO" -> PaymentNetwork.MAESTRO
            "ELECTRON" -> PaymentNetwork.ELECTRON
            "ELO" -> PaymentNetwork.ELO
            "INTERAC" -> PaymentNetwork.INTERAC
            else -> PaymentNetwork.VISA // Default fallback
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
            error = errorMessage
        )
    }
}


