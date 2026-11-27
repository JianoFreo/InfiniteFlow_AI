import type { Request, Response } from "express";
import { ENV } from "../../config/env.js";
import { jobService } from "../../clients/jobService.client.js";
import type { ServiceUsage } from "../../clients/jobService.client.js";
import type { Identity } from "../../middlewares/identity.middleware.js";
import { billingEnabled } from "../../services/billing/stripe.js";
import { clientKey } from "../../utils/clientKey.js";
import { forwardServiceError } from "../../utils/forwardServiceError.js";

export interface UsageView extends ServiceUsage {
  /** False when Stripe isn't configured: the UI hides "Upgrade". */
  billingEnabled: boolean;
  /** Shown on the Pro plan card, e.g. "$9 / month". Keep it in line with the Stripe Price. */
  proPriceLabel: string;
}

/** GET /api/usage: the caller's plan, today's allowance and what every plan offers. */
export const getUsage = async (req: Request, res: Response<UsageView | { message: string }>) => {
  const identity: Identity = res.locals.identity;
  try {
    const usage = await jobService.usage(identity.owner, clientKey(req));
    return res.status(200).json({ ...usage, billingEnabled: billingEnabled(), proPriceLabel: ENV.PRO_PRICE_LABEL });
  } catch (err) {
    return forwardServiceError(err, res, "Could not load your usage");
  }
};
