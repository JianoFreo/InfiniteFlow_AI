import type { Request, Response } from "express";
import type Stripe from "stripe";
import { ENV } from "../../config/env.js";
import { jobService } from "../../clients/jobService.client.js";
import type { Identity } from "../../middlewares/identity.middleware.js";
import { billingEnabled, stripe, stripeId, toBillingUpdate } from "../../services/billing/stripe.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";

type UrlResponse = { url: string } | { message: string };

const notConfigured = (res: Response) => res.status(503).json({ message: "Billing is not set up on this server" });

/** Stripe's own errors (bad key, network) are a gateway problem, not the browser's. */
const stripeFailed = (err: unknown, res: Response, what: string) => {
  const type = err && typeof err === "object" && "type" in err ? String(err.type) : "";
  if (type.startsWith("Stripe")) {
    console.error(`[bff] stripe ${what} failed:`, err instanceof Error ? err.message : type);
    return res.status(502).json({ message: "The payment provider is unavailable. Try again in a minute." });
  }
  return forwardServiceError(err, res, `Could not ${what}`);
};

/** POST /api/billing/checkout: a Stripe Checkout page for the Pro subscription. Accounts only. */
export const createCheckout = async (_req: Request, res: Response<UrlResponse>) => {
  if (!billingEnabled()) return notConfigured(res);
  const identity: Identity = res.locals.identity;
  if (!identity.user) return res.status(401).json({ message: "Create a free account first, then upgrade." });

  try {
    const user = await jobService.getUser(identity.user.id);
    if (user.plan === "pro") {
      return res.status(409).json({ message: "You're already on Pro. Use Manage billing to change it." });
    }
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: ENV.STRIPE_PRICE_PRO!, quantity: 1 }],
      ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
      client_reference_id: String(user.id),
      subscription_data: { metadata: { userId: String(user.id) } },
      allow_promotion_codes: true,
      success_url: `${ENV.APP_URL}/?billing=success`,
      cancel_url: `${ENV.APP_URL}/?billing=cancel`,
    });
    if (!session.url) return res.status(502).json({ message: "The payment provider did not return a checkout page" });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return stripeFailed(err, res, "start checkout");
  }
};

/** POST /api/billing/portal: Stripe's page to change card, see invoices or cancel. */
export const createPortal = async (_req: Request, res: Response<UrlResponse>) => {
  if (!billingEnabled()) return notConfigured(res);
  const identity: Identity = res.locals.identity;
  if (!identity.user) return res.status(401).json({ message: "Log in to manage billing." });

  try {
    const user = await jobService.getUser(identity.user.id);
    if (!user.stripeCustomerId) return res.status(409).json({ message: "You don't have a subscription yet." });
    const session = await stripe().billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${ENV.APP_URL}/` });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return stripeFailed(err, res, "open billing");
  }
};

/** Reads the subscription fresh from Stripe (events can arrive out of order) and stores it in job-service. */
const syncSubscription = async (subscriptionId: string, userIdText: string | null | undefined) => {
  const userId = Number(userIdText);
  if (!Number.isInteger(userId) || userId < 1) {
    console.warn(`[bff] stripe subscription ${subscriptionId} has no userId, ignored`);
    return;
  }
  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const update = toBillingUpdate(subscription);
  await jobService.updateBilling(userId, update);
  console.log(`[bff] billing user=${userId} plan=${update.plan} status=${update.status}`);
};

/**
 * POST /api/billing/webhook (raw body). Stripe calls this; the signature proves it. A 500 makes Stripe retry,
 * so it is only returned when saving failed.
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  if (!ENV.STRIPE_SECRET_KEY || !ENV.STRIPE_WEBHOOK_SECRET) return notConfigured(res);
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: "Missing Stripe signature" });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(req.body, signature, ENV.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ message: "Invalid Stripe signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscriptionId = stripeId(session.subscription);
        if (session.mode === "subscription" && subscriptionId) await syncSubscription(subscriptionId, session.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await syncSubscription(subscription.id, subscription.metadata?.userId);
        break;
      }
      default:
        break; // not needed: acknowledge so Stripe stops sending it
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[bff] stripe webhook ${event.type} failed:`, err instanceof Error ? err.message : err);
    return res.status(500).json({ message: "Could not process the event" });
  }
};
