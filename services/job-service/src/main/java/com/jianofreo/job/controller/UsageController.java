package com.jianofreo.job.controller;

import com.jianofreo.job.dto.job.UsageResponse;
import com.jianofreo.job.service.QuotaService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Internal API, called by the BFF: the caller's plan and how much of today's allowance is left. */
@RestController
@RequestMapping("usage")
@RequiredArgsConstructor
public class UsageController {

    private final QuotaService quotaService;

    @GetMapping
    public UsageResponse usage(@RequestParam String owner, @RequestParam(required = false) String clientKey) {
        return quotaService.usage(owner, clientKey);
    }
}
