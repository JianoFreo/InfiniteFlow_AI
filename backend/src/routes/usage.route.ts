import { Router } from "express";
import { getUsage } from "../controllers/usage/getRequests.controller.js";
import { identify } from "../middlewares/identity.middleware.js";

const router = Router();
router.use(identify);

router.get("/", getUsage);

export default router;
