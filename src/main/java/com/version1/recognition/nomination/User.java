package com.version1.recognition.nomination;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

/**
 * A known person in the platform's own directory - the real backing for what
 * used to be four hardcoded personas in the frontend. Deliberately minimal:
 * no password, no session, no login. Identity is still asserted by the
 * caller (see NominationService), this table only answers "is that a real,
 * known email, and what role does it have" - it does not authenticate
 * anyone.
 * <p>
 * Write-once, like AuditLogEntry: there's no edit-profile flow in this
 * scope, so there are no setters.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.CHAR)
    private UUID id;

    @Column(nullable = false)
    private String name;

    // The lookup key - see UserRepository#findByEmailIgnoreCase.
    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Role role;

    // Free text, e.g. "Lead Consultant · Data & AI" - display only.
    private String title;

    protected User() {
        // required by JPA
    }

    public User(String name, String email, Role role, String title) {
        this.name = name;
        this.email = email;
        this.role = role;
        this.title = title;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public Role getRole() {
        return role;
    }

    public String getTitle() {
        return title;
    }
}
