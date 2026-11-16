package com.jianofreo.worker.messaging;

import com.jianofreo.worker.config.RabbitConfig;
import com.jianofreo.worker.config.WorkerProperties;
import com.jianofreo.worker.dto.message.ChunkTask;
import com.jianofreo.worker.dto.message.ProgressMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Reports to job-service on interp.progress. Plain JSON bodies, same shape as before.
 * PROGRESS ticks are fire-and-forget (the next one replaces a lost one); DONE and FAILED are
 * persistent and must succeed, otherwise the chunk is not acked and gets redone.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProgressPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final WorkerProperties props;

    public void progress(ChunkTask task, int framesDone) {
        send(message(task, "PROGRESS", framesDone, null, null), false);
    }

    public void done(ChunkTask task, int framesDone, String outputPath) {
        send(message(task, "DONE", framesDone, outputPath, null), true);
    }

    public void failed(ChunkTask task, String error) {
        send(message(task, "FAILED", null, null, error), true);
    }

    private ProgressMessage message(ChunkTask task, String status, Integer framesDone, String outputPath, String error) {
        return new ProgressMessage(task.getJobId(), task.getChunkIndex(), status, framesDone, outputPath, error, props.name());
    }

    private void send(ProgressMessage payload, boolean persistent) {
        try {
            Message message = MessageBuilder.withBody(objectMapper.writeValueAsBytes(payload))
                    .setContentType("application/json")
                    .setDeliveryMode(persistent ? MessageDeliveryMode.PERSISTENT : MessageDeliveryMode.NON_PERSISTENT)
                    .build();
            rabbitTemplate.send("", RabbitConfig.PROGRESS_QUEUE, message);
        } catch (RuntimeException e) {
            if (persistent) {
                throw e;
            }
            log.warn("progress_publish_failed job={} chunk={} error={}", payload.getJobId(), payload.getChunkIndex(), e.getMessage());
        }
    }
}
