package com.jianofreo.job.service;

import com.jianofreo.job.client.MediaClient;
import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.job.JobRequest;
import com.jianofreo.job.exception.ApiException;
import com.jianofreo.job.repository.JobChunkRepository;
import com.jianofreo.job.repository.JobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Guests may run one video at a time, signed-in users several. The check happens before any real work. */
class JobServiceLimitTest {

    private final JobRepository jobRepository = mock(JobRepository.class);
    private final MediaClient mediaClient = mock(MediaClient.class);
    private final AppProperties props =
            new AppProperties("http://media", "/data", 2, "http://bff", "k", "python", ".", 2, 500, 30, 10, 1, 5);
    private final JobService service = new JobService(jobRepository, mock(JobChunkRepository.class), mediaClient,
            mock(JobEventPublisher.class), mock(JobRunner.class), mock(ProgressTracker.class), props, mock(LocalFiles.class));

    private static JobRequest request(String owner) {
        return new JobRequest(1, 4, "flow", null, owner);
    }

    @Test
    void aGuestWithARunningVideoMustWait() {
        when(jobRepository.countByOwnerIdAndStatusIn(eq("g:abc"), anyCollection())).thenReturn(1L);

        assertThatThrownBy(() -> service.createJob(request("g:abc")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getMessage()).contains("sign up");
                });
        verifyNoInteractions(mediaClient);
    }

    @Test
    void aSignedInUserCanRunSeveralButNotUnlimited() {
        when(jobRepository.countByOwnerIdAndStatusIn(eq("u:4"), anyCollection())).thenReturn(5L);

        assertThatThrownBy(() -> service.createJob(request("u:4")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(mediaClient);

        // 4 running is still under the limit of 5, so the request gets past the check and reaches media-service
        when(jobRepository.countByOwnerIdAndStatusIn(eq("u:4"), anyCollection())).thenReturn(4L);
        when(mediaClient.getMedia(any())).thenThrow(ApiException.badRequest("stop here"));
        assertThatThrownBy(() -> service.createJob(request("u:4"))).hasMessage("stop here");
    }
}
