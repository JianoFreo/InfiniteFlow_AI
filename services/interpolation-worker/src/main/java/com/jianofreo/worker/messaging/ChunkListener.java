package com.jianofreo.worker.messaging;

import com.jianofreo.worker.config.RabbitConfig;
import com.jianofreo.worker.dto.message.ChunkTask;
import com.jianofreo.worker.service.ChunkService;
import com.jianofreo.worker.service.ChunkService.Outcome;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Takes chunks off interp.chunks, one at a time (prefetch = 1), and acks MANUALLY after the work is
 * reported, so a crash mid-chunk hands the chunk to another replica instead of losing it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChunkListener {

    private final ChunkService chunkService;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = RabbitConfig.CHUNK_QUEUE, ackMode = "MANUAL")
    public void onChunk(Message message, Channel channel) {
        long tag = message.getMessageProperties().getDeliveryTag();
        boolean redelivered = Boolean.TRUE.equals(message.getMessageProperties().getRedelivered());

        Outcome outcome;
        try {
            ChunkTask task = objectMapper.readValue(message.getBody(), ChunkTask.class);
            if (task.getJobId() == null || task.getChunkIndex() == null) {
                throw new IllegalArgumentException("jobId and chunkIndex are required");
            }
            outcome = chunkService.process(task, redelivered);
        } catch (JacksonException | IllegalArgumentException e) {
            log.error("bad_chunk_message error={} body={}", e.getMessage(),
                    new String(message.getBody(), StandardCharsets.UTF_8));
            outcome = Outcome.REJECT;
        } catch (RuntimeException e) {
            // e.g. DONE couldn't be published. Don't ack: the chunk is redone (its output path is fixed,
            // so redoing it is safe). On the second delivery give up so it can't loop forever.
            log.warn("chunk_not_settled error={}", e.getMessage(), e);
            outcome = redelivered ? Outcome.REJECT : Outcome.REQUEUE;
        }
        settle(channel, tag, outcome);
    }

    private static void settle(Channel channel, long tag, Outcome outcome) {
        try {
            switch (outcome) {
                case ACK -> channel.basicAck(tag, false);
                case REQUEUE -> channel.basicNack(tag, false, true);
                case REJECT -> channel.basicReject(tag, false); // → interp.dlx → interp.chunks.dlq
            }
        } catch (IOException | RuntimeException e) {
            log.warn("could_not_settle tag={} outcome={} error={} (RabbitMQ will redeliver)", tag, outcome, e.getMessage());
        }
    }
}
