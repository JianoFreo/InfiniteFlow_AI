package com.jianofreo.job.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** A registered account. Using the product without one is fine: guests are just a browser-held id on their jobs. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users") // "user" is a reserved word in Postgres
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    private String name;

    private Instant createdAt;
}
