import { Router } from "express";
import { createCheckout, createPortal } from "../controllers/billing/postRequests.controller.js";
import { identify } from "../middlewares/identity.middleware.js";

// The Stripe webhook is mounted separately in app.ts: it needs the raw body, before express.json runs.
const router = Router();
router.use(identify);

router.post("/checkout", createCheckout);
router.post("/portal", createPortal);

export default router;
