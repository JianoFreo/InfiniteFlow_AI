import { Router } from "express";
import { getHealth } from "../controllers/health/getRequests.controller.js";

const router = Router();

router.get("/", getHealth);

export default router;
