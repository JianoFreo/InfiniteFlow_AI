import Stripe from "stripe";
import { ENV } from "../../config/env.js";
import type { BillingUpdate } from "../../clients/jobService.client.js";

/**
 * Stripe lives only in the BFF (the one public service). job-service just stores the result:
 * which plan an account is on and whether it is paid up.
 */
let client: Stripe | null = null;

/** Billing works only when the secret key and the Pro price are set. Otherwise everyone is guest or free. */
export const billingEnabled = () => Boolean(ENV.STRIPE_SECRET_KEY && ENV.STRIPE_PRICE_PRO);

export const stripe = (): Stripe => {
  if (!ENV.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(ENV.STRIPE_SECRET_KEY);
  return client;
};

/** For tests. */
export const setStripeClient = (value: Stripe | null) => {
  client = value;
};

const idOf = (value: string | { id: string } | null | undefined) => (value == null ? null : typeof value === "string" ? value : value.id);

/** What job-service should store for this subscription, as Stripe sees it right now. */
export const toBillingUpdate = (sub: Stripe.Subscription): BillingUpdate => {
  const isPro = sub.items.data.some((item) => item.price.id === ENV.STRIPE_PRICE_PRO);
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    stripeCustomerId: idOf(sub.customer),
    stripeSubscriptionId: sub.id,
    status: sub.status,
    plan: isPro && sub.status !== "canceled" ? "pro" : "free",
    renewsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
};

export { idOf as stripeId };
