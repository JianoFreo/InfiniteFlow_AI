package com.jianofreo.job.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Never contains the password hash. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Integer id;
    private String email;
    private String name;
    /** "free" or "pro": the plan whose limits apply right now. */
    private String plan;
    /** Needed by the BFF to open Stripe's billing portal. Null until the first checkout. */
    private String stripeCustomerId;
}
