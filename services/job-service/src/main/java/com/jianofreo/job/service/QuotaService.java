package com.jianofreo.job.service;

import com.jianofreo.job.config.PlanProperties;
import com.jianofreo.job.config.PlanProperties.Plan;
import com.jianofreo.job.config.PlanProperties.PlanLimits;
import com.jianofreo.job.dto.job.UsageResponse;
import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.entity.User;
import com.jianofreo.job.exception.ApiException;
import com.jianofreo.job.repository.JobRepository;
import com.jianofreo.job.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

/**
 * The usage limits, like an AI product's: every plan gets a daily allowance of source-video seconds
 * (rolling 24 hours), a longest clip, a highest factor and a number of videos at once.
 *
 *   guest (no account)  -> tiny, and counted per IP as well, so clearing the browser does not reset it
 *   free account        -> a bit more
 *   pro (Stripe)        -> much more, still capped
 *
 * Jobs that FAILED on our side are not counted. Cancelled ones are: the CPU was already spent.
 */
@Service
@RequiredArgsConstructor
public class QuotaService {

    static final Duration WINDOW = Duration.ofHours(24);
    static final List<JobStatus> ACTIVE = List.of(JobStatus.QUEUED, JobStatus.PROCESSING, JobStatus.MERGING);
    private static final Set<String> PAYING = Set.of("active", "trialing");

    public static final String TOO_MANY_RUNNING = "too_many_running";
    public static final String PLAN_LIMIT = "plan_limit";
    public static final String QUOTA_EXCEEDED = "quota_exceeded";

    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final PlanProperties plans;

    /** Pro limits apply only while Stripe says the subscription is paid up. */
    public static Plan planOf(User user) {
        return "pro".equals(user.getPlan()) && PAYING.contains(user.getSubscriptionStatus()) ? Plan.PRO : Plan.FREE;
    }

    public Plan planFor(String ownerId) {
        if (!ownerId.startsWith("u:")) {
            return Plan.GUEST;
        }
        return findUser(ownerId).map(QuotaService::planOf).orElse(Plan.FREE);
    }

    public UsageResponse usage(String ownerId, String clientKey) {
        Plan plan = planFor(ownerId);
        PlanLimits limits = plans.forPlan(plan);
        Used used = used(ownerId, clientKey, plan);
        User user = plan == Plan.GUEST ? null : findUser(ownerId).orElse(null);

        Map<String, PlanLimits> all = new LinkedHashMap<>();
        for (Plan p : Plan.values()) {
            all.put(p.key(), plans.forPlan(p));
        }
        return new UsageResponse(plan.key(), limits, used.seconds(),
                Math.max(0, limits.dailySeconds() - used.seconds()),
                used.oldest() == null ? null : used.oldest().plus(WINDOW),
                (int) jobRepository.countByOwnerIdAndStatusIn(ownerId, ACTIVE),
                user == null ? null : user.getSubscriptionStatus(),
                user == null ? null : user.getPlanRenewsAt(),
                all);
    }

    /** Everything that can be decided before looking at the video. Cheap, so it runs first. */
    public void checkRequest(String ownerId, String clientKey, int factor) {
        Plan plan = planFor(ownerId);
        PlanLimits limits = plans.forPlan(plan);

        if (jobRepository.countByOwnerIdAndStatusIn(ownerId, ACTIVE) >= limits.maxActive()) {
            String next = upsell(plan, l -> l.maxActive() + " at once");
            throw new ApiException(HttpStatus.CONFLICT, TOO_MANY_RUNNING, (limits.maxActive() == 1
                    ? "You already have a video processing. Wait for it to finish."
                    : "You already have " + limits.maxActive() + " videos processing. Wait for one to finish.") + next);
        }
        if (factor > limits.maxFactor()) {
            throw new ApiException(HttpStatus.FORBIDDEN, PLAN_LIMIT,
                    "Your plan goes up to " + limits.maxFactor() + "x." + upsell(plan, l -> "up to " + l.maxFactor() + "x"));
        }
        Used used = used(ownerId, clientKey, plan);
        if (used.seconds() >= limits.dailySeconds()) {
            throw dailyLimit(plan, limits, used);
        }
    }

    /** Once media-service knows how long the video is. */
    public void checkVideo(String ownerId, String clientKey, long durationMs) {
        Plan plan = planFor(ownerId);
        PlanLimits limits = plans.forPlan(plan);
        long seconds = toSeconds(durationMs);

        if (seconds > limits.maxClipSeconds()) {
            throw new ApiException(HttpStatus.FORBIDDEN, PLAN_LIMIT,
                    "This video is " + formatSeconds(seconds) + " long. Your plan accepts clips up to "
                            + formatSeconds(limits.maxClipSeconds()) + "."
                            + upsell(plan, l -> "clips up to " + formatSeconds(l.maxClipSeconds())));
        }
        Used used = used(ownerId, clientKey, plan);
        long remaining = limits.dailySeconds() - used.seconds();
        if (seconds > remaining) {
            if (remaining <= 0) {
                throw dailyLimit(plan, limits, used);
            }
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, QUOTA_EXCEEDED,
                    "This video is " + formatSeconds(seconds) + " long, but you have " + formatSeconds(remaining)
                            + " left today. Try a shorter clip, or wait " + formatWait(used.oldest()) + "."
                            + upsell(plan, l -> formatSeconds(l.dailySeconds()) + " a day"));
        }
    }

    // ------------------------------------------------------------------ helpers

    private record Used(long seconds, Instant oldest) {
    }

    /** A guest is counted by browser id AND by IP hash; whichever used more wins. */
    private Used used(String ownerId, String clientKey, Plan plan) {
        Instant since = Instant.now().minus(WINDOW);
        Used byOwner = new Used(toSeconds(jobRepository.sumDurationMsByOwnerSince(ownerId, since, JobStatus.FAILED)),
                jobRepository.oldestByOwnerSince(ownerId, since, JobStatus.FAILED));
        if (plan != Plan.GUEST || clientKey == null || clientKey.isBlank()) {
            return byOwner;
        }
        Used byClient = new Used(toSeconds(jobRepository.sumGuestDurationMsByClientSince(clientKey, since, JobStatus.FAILED)),
                jobRepository.oldestGuestByClientSince(clientKey, since, JobStatus.FAILED));
        return byClient.seconds() > byOwner.seconds() ? byClient : byOwner;
    }

    private ApiException dailyLimit(Plan plan, PlanLimits limits, Used used) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, QUOTA_EXCEEDED,
                "You've used today's " + formatSeconds(limits.dailySeconds()) + " of video. More frees up in "
                        + formatWait(used.oldest()) + "."
                        + upsell(plan, l -> formatSeconds(l.dailySeconds()) + " a day"));
    }

    /** " Sign up free for X." / " Upgrade to Pro for X." / "" for Pro. */
    private String upsell(Plan plan, Function<PlanLimits, String> what) {
        return switch (plan) {
            case GUEST -> " Sign up free for " + what.apply(plans.free()) + ".";
            case FREE -> " Upgrade to Pro for " + what.apply(plans.pro()) + ".";
            case PRO -> "";
        };
    }

    private Optional<User> findUser(String ownerId) {
        try {
            return userRepository.findById(Integer.valueOf(ownerId.substring(2)));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    static long toSeconds(long durationMs) {
        return (durationMs + 999) / 1000;
    }

    static String formatSeconds(long seconds) {
        if (seconds < 60) return seconds + " s";
        long min = seconds / 60;
        long s = seconds % 60;
        return s == 0 ? min + " min" : min + " min " + s + " s";
    }

    static String formatWait(Instant oldest) {
        if (oldest == null) return "a moment";
        long minutes = Duration.between(Instant.now(), oldest.plus(WINDOW)).toMinutes();
        if (minutes < 1) return "under a minute";
        if (minutes < 60) return minutes + " min";
        long h = minutes / 60;
        long m = minutes % 60;
        return m == 0 ? h + " h" : h + " h " + m + " min";
    }
}
