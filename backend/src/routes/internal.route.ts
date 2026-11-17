import { Router } from "express";
import { receiveJobEvents } from "../controllers/internal/postRequests.controller.js";
import { requireInternalKey } from "../middlewares/internalKey.middleware.js";

const router = Router();

router.post("/job-events", requireInternalKey, receiveJobEvents);

export default router;
