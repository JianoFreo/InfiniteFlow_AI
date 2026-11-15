package com.jianofreo.job.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient mediaRestClient(AppProperties props) {
        return RestClient.builder().baseUrl(props.mediaServiceUrl()).build();
    }
}
