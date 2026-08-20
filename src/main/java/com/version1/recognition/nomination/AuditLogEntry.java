package com.version1.recognition.nomination;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "nomination_audit_log")
public class AuditLogEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID nominationId;

    @Column(nullable = false)
    private String coordinatorEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuditAction action;

    // Mandatory for REJECTED and RESUBMISSION_REQUESTED, null for APPROVED.
    @Lob
    private String reason;

    @Column(nullable = false)
    private Instant occurredAt;

    protected AuditLogEntry() {
        // required by JPA
    }

    public AuditLogEntry(UUID nominationId, String coordinatorEmail, AuditAction action, String reason) {
        this.nominationId = nominationId;
        this.coordinatorEmail = coordinatorEmail;
        this.action = action;
        this.reason = reason;
        this.occurredAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getNominationId() {
        return nominationId;
    }

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public AuditAction getAction() {
        return action;
    }

    public String getReason() {
        return reason;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
