package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.config.PlanProperties;
import com.jianofreo.job.config.PlanProperties.PlanLimits;
import com.jianofreo.job.dto.job.JobRequest;
import com.jianofreo.job.dto.job.UsageResponse;
import com.jianofreo.job.dto.media.MediaResponse;
import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.entity.User;
import com.jianofreo.job.exception.ApiException;
import com.jianofreo.job.repository.JobChunkRepository;
import com.jianofreo.job.repository.JobRepository;
import com.jianofreo.job.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** The plan limits: guest tiny, free account a bit more, Pro much more but still capped. */
class QuotaServiceTest {

    static final PlanProperties PLANS = new PlanProperties(
            new PlanLimits(30, 10, 2, 1),
            new PlanLimits(180, 30, 4, 2),
            new PlanLimits(1800, 180, 8, 5));

    private final JobRepository jobs = mock(JobRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final QuotaService quota = new QuotaService(jobs, users, PLANS);

    private void ownerUsedMs(String owner, long ms) {
        when(jobs.sumDurationMsByOwnerSince(eq(owner), any(), eq(JobStatus.FAILED))).thenReturn(ms);
        when(jobs.oldestByOwnerSince(eq(owner), any(), eq(JobStatus.FAILED)))
                .thenReturn(ms > 0 ? Instant.now().minusSeconds(3600) : null);
    }

    private void account(int id, String plan, String status) {
        User user = new User(id, "a@b.co", "hash", null, Instant.now());
        user.setPlan(plan);
        user.setSubscriptionStatus(status);
        when(users.findById(id)).thenReturn(Optional.of(user));
    }

    private static void assertRejected(Runnable call, HttpStatus status, String code, String messagePart) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(status);
            assertThat(e.getCode()).isEqualTo(code);
            assertThat(e.getMessage()).contains(messagePart);
        });
    }

    @Test
    void aGuestWithARunningVideoMustWait() {
        when(jobs.countByOwnerIdAndStatusIn(eq("g:abc"), anyCollection())).thenReturn(1L);
        assertRejected(() -> quota.checkRequest("g:abc", null, 2), HttpStatus.CONFLICT, QuotaService.TOO_MANY_RUNNING, "Sign up");
    }

    @Test
    void aGuestCannotPickAFactorAboveTheirPlan() {
        assertRejected(() -> quota.checkRequest("g:abc", null, 4), HttpStatus.FORBIDDEN, QuotaService.PLAN_LIMIT, "up to 4x");
        assertThatCode(() -> quota.checkRequest("g:abc", null, 2)).doesNotThrowAnyException();
    }

    @Test
    void aGuestOverTheDailyAllowanceIsRejectedBeforeUploadWork() {
        ownerUsedMs("g:abc", 30_000);
        assertRejected(() -> quota.checkRequest("g:abc", null, 2), HttpStatus.TOO_MANY_REQUESTS, QuotaService.QUOTA_EXCEEDED, "3 min a day");
    }

    @Test
    void aClipLongerThanThePlanAllowsIsRejected() {
        assertRejected(() -> quota.checkVideo("g:abc", null, 12_000), HttpStatus.FORBIDDEN, QuotaService.PLAN_LIMIT, "up to 10 s");
        assertThatCode(() -> quota.checkVideo("g:abc", null, 10_000)).doesNotThrowAnyException();
    }

    @Test
    void aVideoLongerThanWhatIsLeftTodayIsRejected() {
        ownerUsedMs("g:abc", 25_000); // 5 s left
        assertRejected(() -> quota.checkVideo("g:abc", null, 8_000), HttpStatus.TOO_MANY_REQUESTS, QuotaService.QUOTA_EXCEEDED, "5 s left");
        assertThatCode(() -> quota.checkVideo("g:abc", null, 5_000)).doesNotThrowAnyException();
    }

    @Test
    void guestsOnTheSameIpShareTheirAllowance() {
        ownerUsedMs("g:fresh-browser", 0);
        when(jobs.sumGuestDurationMsByClientSince(eq("ip-hash"), any(), eq(JobStatus.FAILED))).thenReturn(30_000L);
        when(jobs.oldestGuestByClientSince(eq("ip-hash"), any(), eq(JobStatus.FAILED))).thenReturn(Instant.now().minusSeconds(60));

        assertRejected(() -> quota.checkRequest("g:fresh-browser", "ip-hash", 2), HttpStatus.TOO_MANY_REQUESTS, QuotaService.QUOTA_EXCEEDED, "today");
        assertThat(quota.usage("g:fresh-browser", "ip-hash").getRemainingSeconds()).isZero();
    }

    @Test
    void accountsAreNotLimitedByIp() {
        account(4, null, null);
        ownerUsedMs("u:4", 0);
        when(jobs.sumGuestDurationMsByClientSince(any(), any(), any())).thenReturn(999_000L);
        assertThatCode(() -> quota.checkRequest("u:4", "ip-hash", 4)).doesNotThrowAnyException();
        verify(jobs, never()).sumGuestDurationMsByClientSince(any(), any(), any());
    }

    @Test
    void aPaidProAccountGetsProLimits() {
        account(4, "pro", "active");
        ownerUsedMs("u:4", 600_000); // 10 min used, Pro has 30
        assertThatCode(() -> quota.checkRequest("u:4", null, 8)).doesNotThrowAnyException();
        assertThatCode(() -> quota.checkVideo("u:4", null, 120_000)).doesNotThrowAnyException();

        UsageResponse usage = quota.usage("u:4", null);
        assertThat(usage.getPlan()).isEqualTo("pro");
        assertThat(usage.getUsedSeconds()).isEqualTo(600);
        assertThat(usage.getRemainingSeconds()).isEqualTo(1200);
        assertThat(usage.getResetsAt()).isAfter(Instant.now());
        assertThat(usage.getPlans()).containsOnlyKeys("guest", "free", "pro");
    }

    @Test
    void aProAccountThatStoppedPayingFallsBackToFree() {
        account(4, "pro", "past_due");
        assertThat(quota.planFor("u:4")).isEqualTo(PlanProperties.Plan.FREE);
        assertRejected(() -> quota.checkRequest("u:4", null, 8), HttpStatus.FORBIDDEN, QuotaService.PLAN_LIMIT, "Upgrade to Pro");
    }

    @Test
    void proIsStillCapped() {
        account(4, "pro", "active");
        ownerUsedMs("u:4", 1_800_000);
        assertRejected(() -> quota.checkRequest("u:4", null, 2), HttpStatus.TOO_MANY_REQUESTS, QuotaService.QUOTA_EXCEEDED, "30 min");
    }

    @Test
    void formatsDurationsForPeople() {
        assertThat(QuotaService.formatSeconds(45)).isEqualTo("45 s");
        assertThat(QuotaService.formatSeconds(180)).isEqualTo("3 min");
        assertThat(QuotaService.formatSeconds(90)).isEqualTo("1 min 30 s");
        assertThat(QuotaService.toSeconds(1)).isEqualTo(1);
    }

    /** JobService checks the plan before calling media-service, and the clip length after. */
    @Test
    void jobServiceChecksBeforeAndAfterLookingAtTheVideo() {
        MediaClient media = mock(MediaClient.class);
        AppProperties props = new AppProperties("http://media", "/data", 2, "http://bff", "k", "python", ".", 2, 500, 30, 10);
        JobService service = new JobService(jobs, mock(JobChunkRepository.class), media,
                mock(JobEventPublisher.class), mock(JobRunner.class), mock(ProgressTracker.class), quota, props);

        assertThatThrownBy(() -> service.createJob(new JobRequest(1, 8, "flow", null, "g:abc")))
                .isInstanceOf(ApiException.class);
        verifyNoInteractions(media);

        MediaResponse longVideo = new MediaResponse(1, "SOURCE", "a.mp4", "/data/a.mp4", 1L, "30/1", 30.0,
                640, 360, 600, 20_000L, false);
        when(media.getMedia(1)).thenReturn(longVideo);
        assertRejected(() -> service.createJob(new JobRequest(1, 2, "flow", null, "g:abc")),
                HttpStatus.FORBIDDEN, QuotaService.PLAN_LIMIT, "20 s long");
        verify(jobs, never()).save(any());
    }
}
