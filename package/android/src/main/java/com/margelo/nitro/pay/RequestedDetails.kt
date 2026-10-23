package com.margelo.nitro.pay

/**
 * The details a [PaymentRequest] asks the payer for.
 *
 * Google Pay only collects a phone number with an address, so a phone number
 * is requested with the shipping address, or else with the billing address.
 */
internal data class RequestedDetails(
    val billingContact: Boolean = false,
    val shippingContact: Boolean = false,
    val email: Boolean = false,
    val phoneNumber: Boolean = false
) {
    val phoneNumberOnShippingAddress: Boolean
        get() = phoneNumber && shippingContact

    val phoneNumberOnBillingAddress: Boolean
        get() = phoneNumber && !shippingContact

    val billingAddressRequired: Boolean
        get() = billingContact || phoneNumberOnBillingAddress

    companion object {
        fun from(request: PaymentRequest) = RequestedDetails(
            billingContact = request.billingContactRequired == true,
            shippingContact = request.shippingContactRequired == true,
            email = request.emailRequired == true,
            phoneNumber = request.phoneNumberRequired == true
        )
    }
}
