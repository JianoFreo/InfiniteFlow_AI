package com.jianofreo.job.dto.auth;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Sent by the BFF after a Stripe webhook: the subscription as Stripe sees it right now. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BillingRequest {
    @Size(max = 64)
    private String stripeCustomerId;

    @Size(max = 64)
    private String stripeSubscriptionId;

    @Size(max = 32)
    private String status;

    @Pattern(regexp = "free|pro", message = "must be 'free' or 'pro'")
    private String plan;

    private Instant renewsAt;
}
