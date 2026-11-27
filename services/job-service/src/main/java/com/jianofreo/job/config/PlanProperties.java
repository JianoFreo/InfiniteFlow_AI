package com.jianofreo.job.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * What each plan may do, from application.properties ("app.plans.guest.daily-seconds=30" ...).
 * Usage is counted in source-video seconds over a rolling 24 hours, like the usage caps of AI products.
 */
@ConfigurationProperties(prefix = "app.plans")
public record PlanProperties(PlanLimits guest, PlanLimits free, PlanLimits pro) {

    /**
     * @param dailySeconds   source-video seconds allowed per rolling 24 hours
     * @param maxClipSeconds the longest single video accepted
     * @param maxFactor      the highest interpolation factor (2 to 8)
     * @param maxActive      videos processing at the same time
     */
    public record PlanLimits(int dailySeconds, int maxClipSeconds, int maxFactor, int maxActive) {
    }

    public PlanLimits forPlan(Plan plan) {
        return switch (plan) {
            case GUEST -> guest;
            case FREE -> free;
            case PRO -> pro;
        };
    }

    public enum Plan {
        GUEST, FREE, PRO;

        public String key() {
            return name().toLowerCase();
        }
    }
}
