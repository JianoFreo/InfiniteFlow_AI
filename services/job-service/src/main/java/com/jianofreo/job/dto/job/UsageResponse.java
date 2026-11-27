package com.jianofreo.job.dto.job;

import com.jianofreo.job.config.PlanProperties.PlanLimits;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/** How much of today's allowance the caller has used, and what every plan offers (so the UI never hard-codes limits). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsageResponse {
    /** "guest", "free" or "pro". */
    private String plan;
    private PlanLimits limits;
    private long usedSeconds;
    private long remainingSeconds;
    /** When the oldest counted video leaves the 24-hour window. Null when nothing is counted. */
    private Instant resetsAt;
    private int activeJobs;
    /** Stripe's status for an account with a subscription, else null. */
    private String subscriptionStatus;
    private Instant renewsAt;
    /** Every plan in order: guest, free, pro. */
    private Map<String, PlanLimits> plans;
}
