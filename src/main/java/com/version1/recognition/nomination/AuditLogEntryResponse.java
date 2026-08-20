package com.version1.recognition.nomination;

import java.time.Instant;
import java.util.UUID;

public class AuditLogEntryResponse {

    private final UUID id;
    private final String coordinatorEmail;
    private final AuditAction action;
    private final String reason;
    private final Instant occurredAt;

    public AuditLogEntryResponse(AuditLogEntry entry) {
        this.id = entry.getId();
        this.coordinatorEmail = entry.getCoordinatorEmail();
        this.action = entry.getAction();
        this.reason = entry.getReason();
        this.occurredAt = entry.getOccurredAt();
    }

    public UUID getId() {
        return id;
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
