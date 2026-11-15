package com.jianofreo.job.controller;

import com.jianofreo.job.dto.job.ChunkResponse;
import com.jianofreo.job.dto.job.JobRequest;
import com.jianofreo.job.dto.job.JobResponse;
import com.jianofreo.job.service.JobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Internal API. Called by the BFF, and by the interpolation-worker to check that a job is still active before starting a chunk. */
@RestController
@RequestMapping("jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JobResponse createJob(@Valid @RequestBody JobRequest request) {
        return jobService.createJob(request);
    }

    @GetMapping
    public List<JobResponse> listJobs(@RequestParam(defaultValue = "50") int limit,
                                      @RequestParam(defaultValue = "false") boolean activeOnly) {
        return jobService.listJobs(limit, activeOnly);
    }

    @GetMapping("{id}")
    public JobResponse getJob(@PathVariable Integer id) {
        return jobService.getJob(id);
    }

    @GetMapping("{id}/chunks")
    public List<ChunkResponse> getChunks(@PathVariable Integer id) {
        return jobService.getChunks(id);
    }

    @PostMapping("{id}/cancel")
    public JobResponse cancelJob(@PathVariable Integer id) {
        return jobService.cancelJob(id);
    }

    @DeleteMapping("{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteJob(@PathVariable Integer id) {
        jobService.deleteJob(id);
    }
}
