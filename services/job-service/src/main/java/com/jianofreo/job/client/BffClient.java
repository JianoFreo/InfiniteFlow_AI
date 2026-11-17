package com.jianofreo.job.client;

import com.jianofreo.job.config.AppProperties;
import com.jianofreo.job.dto.event.JobEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/** HTTP call from job-service to the BFF, so open browsers see a job change the moment it happens. */
@Slf4j
@Component
@RequiredArgsConstructor
public class BffClient {

    private final RestClient bffRestClient;
    private final AppProperties props;

    /**
     * Runs on the single "eventExecutor" thread, so the caller never waits and events keep their order.
     * Losing one is harmless: the browser reloads the job from REST whenever its status changes or it reconnects.
     */
    @Async("eventExecutor")
    public void sendEvent(JobEvent event) {
        try {
            bffRestClient.post()
                    .uri(props.bffEventsUrl())
                    .header("X-Internal-Key", props.internalKey())
                    .body(List.of(event))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            log.debug("Could not push job event to the BFF: {}", e.getMessage());
        }
    }
}
