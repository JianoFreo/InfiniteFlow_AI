import { Router } from "express";
import { deleteJob } from "../controllers/job/deleteRequests.controller.js";
import { downloadJob, getJob, getJobs } from "../controllers/job/getRequests.controller.js";
import { addJob } from "../controllers/job/postRequests.controller.js";
import { cancelJob } from "../controllers/job/updateRequests.controller.js";
import { validateJobId, validateJobOptions } from "../middlewares/validateJobOptions.middleware.js";
import { streamJobs } from "../services/job-sse/index.js";

const router = Router();

// GET
router.get("/", getJobs);
router.get("/stream", streamJobs); // must be registered before "/:job_id"
router.get("/:job_id", validateJobId, getJob);
router.get("/:job_id/download", validateJobId, downloadJob);

// POST
router.post("/", validateJobOptions, addJob);

// PATCH
router.patch("/:job_id/cancel", validateJobId, cancelJob);

// DELETE
router.delete("/:job_id", validateJobId, deleteJob);

export default router;
