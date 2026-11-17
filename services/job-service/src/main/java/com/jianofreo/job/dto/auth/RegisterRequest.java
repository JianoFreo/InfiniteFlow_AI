package com.jianofreo.job.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {
    @NotBlank
    @Email
    @Size(max = 200)
    private String email;

    /** BCrypt only looks at the first 72 bytes. */
    @NotBlank
    @Size(min = 8, max = 72)
    private String password;

    @Size(max = 60)
    private String name;
}
