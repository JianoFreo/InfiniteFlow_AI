import type { Request, Response } from "express";
import { jobService } from "../../clients/jobService.client.js";
import { mediaService } from "../../clients/mediaService.client.js";
import { getJobStreamStats } from "../../services/job-sse/index.js";
import { isRabbitConnected } from "../../services/job-sse/rabbitListener.js";

type ServiceState = "UP" | "DOWN";

interface HealthResponse {
  message: string;
  status: ServiceState;
  services: { bff: ServiceState; jobService: ServiceState; mediaService: ServiceState; rabbitmq: ServiceState };
  liveScreens: number;
}

const check = async (probe: () => Promise<string>): Promise<ServiceState> => {
  try {
    return (await probe()) === "UP" ? "UP" : "DOWN";
  } catch {
    return "DOWN";
  }
};

/** GET /api/health: one look at the whole system. 503 when anything behind the BFF is down. */
export const getHealth = async (_req: Request, res: Response<HealthResponse>) => {
  const [jobState, mediaState] = await Promise.all([check(jobService.health), check(mediaService.health)]);
  const services = {
    bff: "UP" as const,
    jobService: jobState,
    mediaService: mediaState,
    rabbitmq: (isRabbitConnected() ? "UP" : "DOWN") as ServiceState,
  };
  const allUp = Object.values(services).every((state) => state === "UP");
  return res.status(allUp ? 200 : 503).json({
    message: allUp ? "All services are up" : "Some services are down",
    status: allUp ? "UP" : "DOWN",
    services,
    liveScreens: getJobStreamStats().connectedScreens,
  });
};
