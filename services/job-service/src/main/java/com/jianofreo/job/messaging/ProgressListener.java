package com.jianofreo.job.messaging;

import com.jianofreo.job.config.RabbitConfig;
import com.jianofreo.job.dto.message.ProgressMessage;
import com.jianofreo.job.service.JobProgressService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Reads engine reports from interp.progress.
 * concurrency = 1 on purpose: reports are handled in order, so "is this the last chunk?" can't race.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProgressListener {

    private final JobProgressService jobProgressService;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = RabbitConfig.PROGRESS_QUEUE, concurrency = "1")
    public void onProgress(Message message) {
        try {
            ProgressMessage progress = objectMapper.readValue(message.getBody(), ProgressMessage.class);
            jobProgressService.handle(progress);
        } catch (RuntimeException e) {
            // Never throw: a poison message would otherwise be redelivered forever.
            log.error("Could not handle progress message: {}", new String(message.getBody()), e);
        }
    }
}
