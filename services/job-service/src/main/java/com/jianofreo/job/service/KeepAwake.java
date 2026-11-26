package com.jianofreo.job.service;

import com.jianofreo.job.entity.JobStatus;
import com.jianofreo.job.repository.JobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Free hosting (Render) puts a service to sleep after 15 minutes without incoming requests, even while it is
 * processing a video, and a sleeping service loses its files. While any job is active this calls the
 * KEEP_AWAKE_URLS (the public URLs of job-service and media-service). With no jobs it does nothing,
 * so the services can sleep.
 */
@Slf4j
@Component
public class KeepAwake {

    private static final List<JobStatus> ACTIVE = List.of(JobStatus.QUEUED, JobStatus.PROCESSING, JobStatus.MERGING);

    private final JobRepository jobRepository;
    private final List<String> urls;
    private final RestClient client = RestClient.create();

    public KeepAwake(JobRepository jobRepository, @Value("${app.keep-awake-urls:}") List<String> urls) {
        this.jobRepository = jobRepository;
        this.urls = urls.stream().map(String::trim).filter(url -> !url.isEmpty()).toList();
    }

    @Scheduled(fixedDelayString = "${app.keep-awake-interval-ms:300000}")
    public void ping() {
        if (urls.isEmpty() || jobRepository.findByStatusIn(ACTIVE).isEmpty()) {
            return;
        }
        for (String url : urls) {
            try {
                client.get().uri(url).retrieve().toBodilessEntity();
            } catch (RuntimeException e) {
                log.warn("keep_awake_failed url={} error={}", url, e.getMessage());
            }
        }
    }
}
