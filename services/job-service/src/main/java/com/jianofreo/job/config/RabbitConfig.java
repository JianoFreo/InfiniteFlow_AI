package com.jianofreo.job.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Every queue and exchange the system uses. Spring declares them on startup.
 * The interpolation-worker declares the same ones with the SAME arguments; RabbitMQ refuses a re-declare with different arguments.
 *
 *  job-service ──(interp.chunks queue)──────► worker      one message per chunk, work-queue style
 *  worker      ──(interp.progress queue)────► job-service progress / done / failed
 *  job-service ──(interp.cancel fanout)─────► every worker replica
 *  job-service ──(job.events fanout)────────► BFF → browsers over SSE
 */
@Configuration
public class RabbitConfig {

    public static final String CHUNK_QUEUE = "interp.chunks";
    public static final String DEAD_LETTER_EXCHANGE = "interp.dlx";
    public static final String DEAD_LETTER_QUEUE = "interp.chunks.dlq";
    public static final String PROGRESS_QUEUE = "interp.progress";
    public static final String CANCEL_EXCHANGE = "interp.cancel";
    public static final String JOB_EVENTS_EXCHANGE = "job.events";

    @Bean
    public Queue chunkQueue() {
        return QueueBuilder.durable(CHUNK_QUEUE)
                .deadLetterExchange(DEAD_LETTER_EXCHANGE)
                .deadLetterRoutingKey(DEAD_LETTER_QUEUE)
                .build();
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(deadLetterQueue()).to(deadLetterExchange()).with(DEAD_LETTER_QUEUE);
    }

    @Bean
    public Queue progressQueue() {
        return QueueBuilder.durable(PROGRESS_QUEUE).build();
    }

    @Bean
    public FanoutExchange cancelExchange() {
        return new FanoutExchange(CANCEL_EXCHANGE);
    }

    @Bean
    public FanoutExchange jobEventsExchange() {
        return new FanoutExchange(JOB_EVENTS_EXCHANGE);
    }
}
