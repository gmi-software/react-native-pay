import { Alert, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import {
  HybridPaymentHandler,
  type PaymentItem,
  type PaymentRequest,
  type PaymentSheetSelection,
  type StartPaymentOptions,
} from "@gmisoftware/react-native-pay";

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

// What every demo request shares. Today's charge goes in `paymentItems`.
const baseRequest: Omit<PaymentRequest, "paymentItems"> = {
  merchantName: "React Native Pay Demo",
  countryCode: "US",
  currencyCode: "USD",
  merchantCapabilities: ["3DS"],
  supportedNetworks: ["visa", "mastercard", "amex", "discover"],
  googlePayEnvironment: "TEST",
};

const MANAGEMENT_URL = "https://example.com/account/billing";

const cents = (value: number) => (value / 100).toFixed(2);

// One cart for every sheet callback, from what the payer chose so far, so a
// coupon stays applied when the address or the card changes. The library adds
// the shipping method and the total.
function sheetCart(selection: PaymentSheetSelection): PaymentItem[] {
  let subtotal = 4000;
  const items: PaymentItem[] = [
    { label: "Sneakers", amount: cents(subtotal), type: "final" },
  ];
  if (selection.couponCode?.toUpperCase() === "SAVE10") {
    items.push({ label: "SAVE10 (-10%)", amount: cents(-400), type: "final" });
    subtotal -= 400;
  }
  if (selection.shippingAddress?.administrativeArea === "CA") {
    const tax = Math.round(subtotal * 0.0725);
    items.push({ label: "CA sales tax", amount: cents(tax), type: "final" });
  }
  if (selection.card?.type === "credit") {
    const fee = Math.round(subtotal * 0.015);
    items.push({ label: "Credit card fee", amount: cents(fee), type: "final" });
  }
  return items;
}

const sheetUpdates: StartPaymentOptions = {
  onShippingAddressChange: async (address, selection) => ({
    paymentItems: sheetCart(selection),
    ...(address.countryCode !== "US" && {
      error: {
        code: "shippingAddressUnserviceable",
        message: "We only ship within the US.",
      },
    }),
  }),
  onShippingMethodChange: async (_method, selection) => ({
    paymentItems: sheetCart(selection),
  }),
  onPaymentMethodChange: async (_card, selection) => ({
    paymentItems: sheetCart(selection),
  }),
  onCouponCodeChange: (code, selection) => {
    switch (code.toUpperCase()) {
      case "":
      case "SAVE10":
        return Promise.resolve({ paymentItems: sheetCart(selection) });
      case "EXPIRED":
        return Promise.resolve({
          error: {
            code: "couponCodeExpired",
            message: "This code has expired.",
          },
        });
      case "SLOW":
        // Never settles: after 25 seconds the sheet keeps its items.
        return new Promise(() => {});
      default:
        return Promise.resolve({
          error: {
            code: "couponCodeInvalid",
            message: `${code} isn't a code.`,
          },
        });
    }
  },
};

type Demo = {
  title: string;
  detail: string;
  request: () => PaymentRequest;
  options?: StartPaymentOptions;
};

// Built on tap, so the dates stay in the future.
const DEMOS: Demo[] = [
  {
    title: "Coupon, tax and card fee (iOS)",
    detail:
      "Try SAVE10, EXPIRED or SLOW in the coupon field, a California or non-US address, and a credit card.",
    request: () => ({
      ...baseRequest,
      paymentItems: sheetCart({}),
      shippingContactRequired: true,
      shippingMethods: [
        {
          identifier: "standard",
          label: "Standard",
          detail: "3-5 days",
          amount: "0.00",
        },
        {
          identifier: "express",
          label: "Express",
          detail: "Next day",
          amount: "9.00",
        },
      ],
    }),
    options: sheetUpdates,
  },
  {
    title: "Subscription with a free trial",
    detail: "Free for 7 days, then $9.99 a month. Nothing is charged today.",
    request: () => ({
      ...baseRequest,
      paymentItems: [],
      recurring: {
        description: "Premium membership",
        managementUrl: MANAGEMENT_URL,
        billingAgreement:
          "Renews monthly until you cancel. Cancel any time in your account.",
        trialBilling: {
          label: "Free trial",
          amount: "0.00",
          intervalUnit: "day",
          intervalCount: 7,
          endDate: daysFromNow(7),
        },
        regularBilling: {
          label: "Premium Monthly",
          amount: "9.99",
          intervalUnit: "month",
        },
      },
    }),
  },
  {
    title: "Hotel booking",
    detail:
      "$240.00 charged in 30 days, free cancellation for 28 days. No deposit.",
    request: () => ({
      ...baseRequest,
      paymentItems: [],
      deferred: {
        description: "Hotel booking, 2 nights",
        managementUrl: MANAGEMENT_URL,
        deferredBilling: {
          label: "Hotel Booking",
          amount: "240.00",
          date: daysFromNow(30),
        },
        freeCancellation: {
          date: daysFromNow(28),
          timeZone: "Europe/Warsaw",
        },
      },
    }),
  },
  {
    title: "Card top-up",
    detail: "$25.00 now, then $25.00 whenever the balance drops below $5.00.",
    request: () => ({
      ...baseRequest,
      paymentItems: [{ label: "Initial load", amount: "25.00", type: "final" }],
      automaticReload: {
        description: "Coffee card auto top-up",
        managementUrl: MANAGEMENT_URL,
        automaticReloadBilling: {
          label: "Coffee Card Top-Up",
          amount: "25.00",
          thresholdAmount: "5.00",
        },
      },
    }),
  },
];

export default function MoreDemosScreen() {
  const handlePay = async (demo: Demo) => {
    const result = await HybridPaymentHandler.startPayment(
      demo.request(),
      demo.options,
    );
    if (result.status === "success") {
      Alert.alert(
        "Authorized (no server)",
        result.couponCode
          ? `Charge the discount for ${result.couponCode}.`
          : "Send the token to your payment provider.",
      );
    } else if (result.status === "failed") {
      Alert.alert(`Failed: ${result.code}`, result.error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.intro}>
        A cart that follows the payer's choices in the sheet, and payments
        charged again later with a merchant token.
      </Text>
      {DEMOS.map((demo) => (
        <View key={demo.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{demo.title}</Text>
          <Text style={styles.detail}>{demo.detail}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handlePay(demo)}
          >
            <Text style={styles.buttonText}>Pay</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  intro: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  detail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
});
