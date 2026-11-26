package com.jianofreo.media.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * On Render's free tier this service has a public URL, so every request must carry the shared INTERNAL_KEY.
 * Only the health check is open.
 */
@Component
public class InternalKeyFilter extends OncePerRequestFilter {

    static final String DEV_KEY = "dev-internal-key";

    private final byte[] key;

    public InternalKeyFilter(@Value("${app.internal-key}") String key, Environment environment) {
        // Render sets RENDER=true. Never run a public service with the key that is written in the code.
        if ("true".equals(environment.getProperty("RENDER")) && (key.isBlank() || DEV_KEY.equals(key))) {
            throw new IllegalStateException("Set INTERNAL_KEY to a long random value");
        }
        this.key = key.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().equals("/actuator/health");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String sent = request.getHeader("X-Internal-Key");
        if (sent == null || !MessageDigest.isEqual(key, sent.getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Not allowed\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
