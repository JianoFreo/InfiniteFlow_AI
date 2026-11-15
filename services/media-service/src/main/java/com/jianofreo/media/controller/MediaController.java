package com.jianofreo.media.controller;

import com.jianofreo.media.dto.media.MediaResponse;
import com.jianofreo.media.dto.media.MergeRequest;
import com.jianofreo.media.entity.MediaFile;
import com.jianofreo.media.service.MediaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

/** Internal API. Only the BFF (uploads/downloads) and job-service (merge/cleanup) call it. */
@RestController
@RequestMapping("media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MediaResponse upload(@RequestParam("file") MultipartFile file) {
        return mediaService.upload(file);
    }

    @GetMapping("{id}")
    public MediaResponse getMedia(@PathVariable Integer id) {
        return mediaService.getMedia(id);
    }

    /** Streams the file. Spring answers Range requests (206) by itself for a Resource body, so seeking in the player works. */
    @GetMapping("{id}/content")
    public ResponseEntity<Resource> getContent(@PathVariable Integer id) {
        MediaFile media = mediaService.findMedia(id);
        Resource resource = new FileSystemResource(Path.of(media.getStoredPath()));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("video/mp4"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(media.getFileName()).build().toString())
                .body(resource);
    }

    @PostMapping("merge")
    @ResponseStatus(HttpStatus.CREATED)
    public MediaResponse merge(@Valid @RequestBody MergeRequest request) {
        return mediaService.merge(request);
    }

    @DeleteMapping("{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMedia(@PathVariable Integer id) {
        mediaService.deleteMedia(id);
    }

    @DeleteMapping("workdirs/{jobId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWorkdir(@PathVariable Integer jobId) {
        mediaService.deleteWorkdir(jobId);
    }
}
