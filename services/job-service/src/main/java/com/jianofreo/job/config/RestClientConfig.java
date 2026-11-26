package com.jianofreo.job.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient mediaRestClient(AppProperties props) {
        return RestClient.builder()
                .baseUrl(props.mediaServiceUrl())
                .defaultHeader("X-Internal-Key", props.internalKey())
                .build();
    }

    /** Short timeouts: a slow or missing BFF must never slow the engine down. */
    @Bean
    public RestClient bffRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        return RestClient.builder().requestFactory(factory).build();
    }
}
