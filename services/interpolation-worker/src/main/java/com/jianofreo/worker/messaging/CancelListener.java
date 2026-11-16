package com.jianofreo.worker.messaging;

import com.jianofreo.worker.dto.message.CancelMessage;
import com.jianofreo.worker.service.CancelRegistry;
import com.jianofreo.worker.service.EngineRunner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Hears every cancel on the interp.cancel fanout (through this replica's own temporary queue).
 * Runs on its own listener thread, so it works while the chunk listener is busy with a long chunk.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CancelListener {

    private final CancelRegistry cancelRegistry;
    private final EngineRunner engineRunner;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = "#{cancelQueue.name}")
    public void onCancel(Message message) {
        try {
            CancelMessage cancel = objectMapper.readValue(message.getBody(), CancelMessage.class);
            if (cancel.getJobId() == null) {
                return;
            }
            cancelRegistry.add(cancel.getJobId());   // chunks of this job still in the queue get skipped
            engineRunner.cancelJob(cancel.getJobId()); // the one running right now gets stopped
            log.info("job_cancel_received job={}", cancel.getJobId());
        } catch (RuntimeException e) {
            log.warn("bad_cancel_message error={}", e.getMessage());
        }
    }
}
