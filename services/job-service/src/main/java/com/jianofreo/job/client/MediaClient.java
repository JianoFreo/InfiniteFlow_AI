package com.jianofreo.job.client;

import com.jianofreo.job.dto.media.MediaResponse;
import com.jianofreo.job.dto.media.MergeRequest;
import com.jianofreo.job.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/** HTTP calls from job-service to media-service. */
@Slf4j
@Component
@RequiredArgsConstructor
public class MediaClient {

    private final RestClient mediaRestClient;

    public MediaResponse getMedia(Integer mediaId) {
        try {
            return mediaRestClient.get().uri("/media/{id}", mediaId).retrieve().body(MediaResponse.class);
        } catch (HttpClientErrorException.NotFound e) {
            throw ApiException.badRequest("Source media " + mediaId + " does not exist");
        }
    }

    public MediaResponse merge(MergeRequest request) {
        return mediaRestClient.post().uri("/media/merge").body(request).retrieve().body(MediaResponse.class);
    }

    /** Best effort: a missing file must never block deleting a job. */
    public void deleteMediaQuietly(Integer mediaId) {
        if (mediaId == null) {
            return;
        }
        try {
            mediaRestClient.delete().uri("/media/{id}", mediaId).retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.NotFound ignored) {
            // already gone
        } catch (RuntimeException e) {
            log.warn("Could not delete media {}: {}", mediaId, e.getMessage());
        }
    }

    public void deleteWorkdirQuietly(Integer jobId) {
        try {
            mediaRestClient.delete().uri("/media/workdirs/{jobId}", jobId).retrieve().toBodilessEntity();
        } catch (RuntimeException e) {
            log.warn("Could not delete workdir of job {}: {}", jobId, e.getMessage());
        }
    }

    public static ApiException unavailable(RuntimeException e) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "media-service is unavailable: " + e.getMessage());
    }
}
