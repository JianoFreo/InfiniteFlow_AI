import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stripe test settings must exist before the app (and its ENV) is imported.
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy";
process.env.STRIPE_PRICE_PRO = "price_pro";
process.env.APP_URL = "https://app.example";

vi.mock("../../clients/jobService.client.js", () => ({
  jobService: { usage: vi.fn(), updateBilling: vi.fn(), getUser: vi.fn(), health: vi.fn() },
}));

const { jobService } = await import("../../clients/jobService.client.js");
const { stripe } = await import("../../services/billing/stripe.js");
const { createApp } = await import("../../app.js");
const { serviceUsage } = await import("../helper/fixtures.js");
const { signToken } = await import("../../utils/token.js");

const app = createApp();
const GUEST = "test-guest-id-0001";
const token = signToken({ id: 4, email: "a@b.co", name: null });

/** A webhook body signed the way Stripe signs it. */
const signed = (event: object) => {
  const payload = JSON.stringify(event);
  const header = stripe().webhooks.generateTestHeaderString({ payload, secret: "whsec_test_dummy" });
  return request(app)
    .post("/api/billing/webhook")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", header)
    .send(payload);
};

const subscription = (status: string, priceId = "price_pro") => ({
  id: "sub_1",
  object: "subscription",
  customer: "cus_1",
  status,
  metadata: { userId: "4" },
  items: { data: [{ price: { id: priceId }, current_period_end: 1_800_000_000 }] },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/usage", () => {
  it("returns the caller's usage with billing switched on", async () => {
    vi.mocked(jobService.usage).mockResolvedValue(serviceUsage());
    const res = await request(app).get("/api/usage").set("X-Guest-Id", GUEST);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plan: "guest", billingEnabled: true, remainingSeconds: 30 });
    expect(vi.mocked(jobService.usage).mock.calls[0]![0]).toBe(`g:${GUEST}`);
  });
});

describe("Stripe webhook", () => {
  it("rejects a body that Stripe did not sign", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "t=1,v1=forged")
      .send(JSON.stringify({ type: "customer.subscription.updated" }));
    expect(res.status).toBe(400);
    expect(jobService.updateBilling).not.toHaveBeenCalled();
  });

  it("re-reads the subscription and stores Pro for an active one", async () => {
    vi.spyOn(stripe().subscriptions, "retrieve").mockResolvedValue(subscription("active") as never);
    const res = await signed({ id: "evt_1", type: "customer.subscription.updated", data: { object: subscription("active") } });

    expect(res.status).toBe(200);
    expect(jobService.updateBilling).toHaveBeenCalledWith(4, {
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      plan: "pro",
      renewsAt: new Date(1_800_000_000 * 1000).toISOString(),
    });
  });

  it("uses Stripe's current state, not the event's (events can arrive out of order)", async () => {
    vi.spyOn(stripe().subscriptions, "retrieve").mockResolvedValue(subscription("canceled") as never);
    await signed({ id: "evt_2", type: "customer.subscription.updated", data: { object: subscription("active") } });
    expect(vi.mocked(jobService.updateBilling).mock.calls[0]![1]).toMatchObject({ plan: "free", status: "canceled" });
  });

  it("links a finished checkout to the account in client_reference_id", async () => {
    const retrieve = vi.spyOn(stripe().subscriptions, "retrieve").mockResolvedValue(subscription("active") as never);
    await signed({
      id: "evt_3",
      type: "checkout.session.completed",
      data: { object: { object: "checkout.session", mode: "subscription", subscription: "sub_1", client_reference_id: "4" } },
    });
    expect(retrieve).toHaveBeenCalledWith("sub_1");
    expect(jobService.updateBilling).toHaveBeenCalledWith(4, expect.objectContaining({ plan: "pro" }));
  });

  it("asks Stripe to retry when saving fails", async () => {
    vi.spyOn(stripe().subscriptions, "retrieve").mockResolvedValue(subscription("active") as never);
    vi.mocked(jobService.updateBilling).mockRejectedValue(new Error("job-service down"));
    const res = await signed({ id: "evt_4", type: "customer.subscription.created", data: { object: subscription("active") } });
    expect(res.status).toBe(500);
  });

  it("acknowledges events it does not need", async () => {
    const res = await signed({ id: "evt_5", type: "invoice.paid", data: { object: {} } });
    expect(res.status).toBe(200);
    expect(jobService.updateBilling).not.toHaveBeenCalled();
  });
});

describe("checkout and portal", () => {
  it("sends guests to sign up first", async () => {
    const res = await request(app).post("/api/billing/checkout").set("X-Guest-Id", GUEST);
    expect(res.status).toBe(401);
  });

  it("creates a subscription checkout tied to the account", async () => {
    vi.mocked(jobService.getUser).mockResolvedValue({ id: 4, email: "a@b.co", name: null, plan: "free", stripeCustomerId: null });
    const create = vi
      .spyOn(stripe().checkout.sessions, "create")
      .mockResolvedValue({ url: "https://checkout.stripe.com/x" } as never);

    const res = await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://checkout.stripe.com/x");
    expect(create.mock.calls[0]![0]).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_pro", quantity: 1 }],
      customer_email: "a@b.co",
      client_reference_id: "4",
      subscription_data: { metadata: { userId: "4" } },
      success_url: "https://app.example/?billing=success",
    });
  });

  it("does not sell Pro twice", async () => {
    vi.mocked(jobService.getUser).mockResolvedValue({ id: 4, email: "a@b.co", name: null, plan: "pro", stripeCustomerId: "cus_1" });
    const res = await request(app).post("/api/billing/checkout").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it("opens the billing portal for a customer", async () => {
    vi.mocked(jobService.getUser).mockResolvedValue({ id: 4, email: "a@b.co", name: null, plan: "pro", stripeCustomerId: "cus_1" });
    const portal = vi
      .spyOn(stripe().billingPortal.sessions, "create")
      .mockResolvedValue({ url: "https://billing.stripe.com/p" } as never);
    const res = await request(app).post("/api/billing/portal").set("Authorization", `Bearer ${token}`);
    expect(res.body.url).toBe("https://billing.stripe.com/p");
    expect(portal).toHaveBeenCalledWith({ customer: "cus_1", return_url: "https://app.example/" });
  });
});
