package com.jianofreo.worker.client;

import com.jianofreo.worker.dto.job.JobStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class JobClient {

    private static final Set<String> ACTIVE = Set.of("QUEUED", "PROCESSING");

    private final RestClient jobRestClient;

    /**
     * Asked before a chunk starts, so a cancelled or deleted job doesn't burn CPU.
     * If job-service can't be reached we process anyway: job-service ignores results for inactive jobs.
     */
    public boolean isJobActive(int jobId) {
        try {
            JobStatusResponse job = jobRestClient.get().uri("/jobs/{id}", jobId).retrieve().body(JobStatusResponse.class);
            return job != null && ACTIVE.contains(job.getStatus());
        } catch (HttpClientErrorException.NotFound e) {
            return false;
        } catch (RuntimeException e) {
            log.warn("job_status_unavailable job={} error={} (processing anyway)", jobId, e.getMessage());
            return true;
        }
    }
}
