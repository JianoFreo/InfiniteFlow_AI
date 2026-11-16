package com.jianofreo.job.messaging;

import com.jianofreo.job.config.RabbitConfig;
import com.jianofreo.job.dto.message.ChunkTask;
import com.jianofreo.job.dto.message.JobEvent;
import com.jianofreo.job.entity.Job;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * Everything job-service sends to RabbitMQ. Bodies are plain JSON (no Java type headers),
 * so the Java worker and the Node BFF can read them as easily as Java can.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MessagePublisher {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    /** Work queue: RabbitMQ hands each chunk to exactly one worker replica. */
    public void publishChunk(ChunkTask task) {
        send("", RabbitConfig.CHUNK_QUEUE, task, true);
    }

    /** Fanout: every worker replica hears it and stops work on that job. */
    public void publishCancel(Integer jobId) {
        send(RabbitConfig.CANCEL_EXCHANGE, "", Map.of("jobId", jobId), false);
    }

    /** Fanout: the BFF relays it to browsers over SSE. Losing one is harmless, the UI refetches. */
    public void publishJobChanged(Job job) {
        send(RabbitConfig.JOB_EVENTS_EXCHANGE, "",
                new JobEvent(job.getId(), job.getStatus().name(), job.getProgress(),
                        job.getCompletedChunks(), job.getTotalChunks()), false);
    }

    public void publishJobDeleted(Integer jobId) {
        send(RabbitConfig.JOB_EVENTS_EXCHANGE, "", new JobEvent(jobId, "DELETED", 0, 0, 0), false);
    }

    private void send(String exchange, String routingKey, Object payload, boolean persistent) {
        try {
            Message message = MessageBuilder.withBody(objectMapper.writeValueAsBytes(payload))
                    .setContentType("application/json")
                    .setDeliveryMode(persistent ? MessageDeliveryMode.PERSISTENT : MessageDeliveryMode.NON_PERSISTENT)
                    .build();
            rabbitTemplate.send(exchange, routingKey, message);
        } catch (RuntimeException e) {
            if (persistent) {
                throw e;
            }
            log.warn("Could not publish to {}: {}", exchange, e.getMessage());
        }
    }
}
