package com.jianofreo.worker.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The queues and exchanges this worker uses. job-service declares the same ones; the declarations MUST
 * match exactly (arguments included) or RabbitMQ refuses the second one.
 *
 *  job-service ──(interp.chunks queue)────► worker      one message per chunk, one chunk per replica at a time
 *  worker      ──(interp.progress queue)──► job-service  PROGRESS / DONE / FAILED
 *  job-service ──(interp.cancel fanout)───► every worker replica, each through its own temporary queue
 */
@Configuration
public class RabbitConfig {

    public static final String CHUNK_QUEUE = "interp.chunks";
    public static final String DEAD_LETTER_EXCHANGE = "interp.dlx";
    public static final String DEAD_LETTER_QUEUE = "interp.chunks.dlq";
    public static final String PROGRESS_QUEUE = "interp.progress";
    public static final String CANCEL_EXCHANGE = "interp.cancel";

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

    /** Server-named, exclusive, auto-delete: every replica gets its own copy of each cancel. */
    @Bean
    public AnonymousQueue cancelQueue() {
        return new AnonymousQueue();
    }

    @Bean
    public Binding cancelBinding() {
        return BindingBuilder.bind(cancelQueue()).to(cancelExchange());
    }
}
