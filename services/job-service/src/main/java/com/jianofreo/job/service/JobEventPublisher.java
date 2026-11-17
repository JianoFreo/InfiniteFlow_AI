package com.jianofreo.job.service;

import com.jianofreo.job.client.BffClient;
import com.jianofreo.job.dto.event.JobEvent;
import com.jianofreo.job.entity.Job;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Call this right AFTER a job is saved, so the browser never hears about a change that did not happen. */
@Service
@RequiredArgsConstructor
public class JobEventPublisher {

    private final BffClient bffClient;

    public void publishJobChanged(Job job) {
        bffClient.sendEvent(new JobEvent(job.getId(), job.getStatus().name(), job.getProgress(),
                job.getCompletedChunks(), job.getTotalChunks(), job.getOwnerId()));
    }

    public void publishJobDeleted(Integer jobId, String ownerId) {
        bffClient.sendEvent(new JobEvent(jobId, "DELETED", 0, 0, 0, ownerId));
    }
}
