package com.jianofreo.job.service;

import com.jianofreo.job.dto.auth.BillingRequest;
import com.jianofreo.job.dto.auth.LoginRequest;
import com.jianofreo.job.dto.auth.RegisterRequest;
import com.jianofreo.job.dto.auth.UserResponse;
import com.jianofreo.job.entity.User;
import com.jianofreo.job.exception.ApiException;
import com.jianofreo.job.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;

/** Accounts live here (Java owns users). The BFF only turns a successful login into a signed token. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserResponse register(RegisterRequest request) {
        String email = normalize(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        String name = request.getName() == null || request.getName().isBlank() ? null : request.getName().trim();
        User saved = userRepository.save(
                new User(null, email, passwordEncoder.encode(request.getPassword()), name, Instant.now()));
        log.info("user_registered id={}", saved.getId());
        return toResponse(saved);
    }

    public UserResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(normalize(request.getEmail()))
                .filter(found -> passwordEncoder.matches(request.getPassword(), found.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Wrong email or password"));
        return toResponse(user);
    }

    public UserResponse get(Integer id) {
        return userRepository.findById(id).map(AuthService::toResponse)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Account not found"));
    }

    /** The Stripe webhook (through the BFF) reports the subscription's current state. Idempotent: it just overwrites. */
    public UserResponse updateBilling(Integer id, BillingRequest request) {
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Account " + id + " not found"));
        if (request.getStripeCustomerId() != null) {
            user.setStripeCustomerId(request.getStripeCustomerId());
        }
        user.setStripeSubscriptionId(request.getStripeSubscriptionId());
        user.setSubscriptionStatus(request.getStatus());
        user.setPlan(request.getPlan());
        user.setPlanRenewsAt(request.getRenewsAt());
        User saved = userRepository.save(user);
        log.info("user_billing id={} plan={} status={}", id, saved.getPlan(), saved.getSubscriptionStatus());
        return toResponse(saved);
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getName(),
                QuotaService.planOf(user).key(), user.getStripeCustomerId());
    }
}
