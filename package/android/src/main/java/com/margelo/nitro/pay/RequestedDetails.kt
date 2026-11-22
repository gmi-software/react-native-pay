package com.margelo.nitro.pay

/**
 * The details a [PaymentRequest] asks the payer for.
 *
 * Google Pay only collects a phone number with an address, so a phone number
 * is requested with the shipping address, or else with the billing address.
 *
 * [shippingMethod] is the request's first shipping method. Google Pay offers
 * a choice of shipping methods only through its `SHIPPING_OPTION` callback,
 * which the library asks for with a sheet callback (see [CallbackIntents]);
 * then [SheetUpdater] tracks the payer's choice.
 */
internal data class RequestedDetails(
    val billingContact: Boolean = false,
    val shippingContact: Boolean = false,
    val email: Boolean = false,
    val phoneNumber: Boolean = false,
    val shippingMethod: ShippingMethod? = null
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
            phoneNumber = request.phoneNumberRequired == true,
            shippingMethod = request.shippingMethods?.firstOrNull()
        )
    }
}
