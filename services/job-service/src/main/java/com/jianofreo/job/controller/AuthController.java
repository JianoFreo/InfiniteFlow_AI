package com.jianofreo.job.controller;

import com.jianofreo.job.dto.auth.LoginRequest;
import com.jianofreo.job.dto.auth.RegisterRequest;
import com.jianofreo.job.dto.auth.UserResponse;
import com.jianofreo.job.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Internal API, called by the BFF only. */
@RestController
@RequestMapping("auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("login")
    public UserResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("users/{id}")
    public UserResponse get(@PathVariable Integer id) {
        return authService.get(id);
    }
}
