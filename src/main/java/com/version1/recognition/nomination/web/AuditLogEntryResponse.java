package com.version1.recognition.nomination.web;

import com.version1.recognition.nomination.model.AuditAction;
import com.version1.recognition.nomination.model.AuditLogEntry;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

public class AuditLogEntryResponse {

    private final UUID id;
    private final String coordinatorEmail;
    private final AuditAction action;
    private final String reason;
    private final String comment;
    private final List<Map<String, String>> comms;
    private final Instant occurredAt;

    public AuditLogEntryResponse(AuditLogEntry entry) {
        this.id = entry.getId();
        this.coordinatorEmail = entry.getCoordinatorEmail();
        this.action = entry.getAction();
        this.reason = entry.getReason();
        this.comment = entry.getComment();
        this.comms = entry.getComms().stream().map(c -> {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("recipientEmail", c.getRecipientEmail());
            m.put("recipientRole", c.getRecipientRole().name());
            m.put("subject", c.getSubject());
            m.put("body", c.getBody());
            m.put("sentAt", c.getSentAt() == null ? null : c.getSentAt().toString());
            return m;
        }).collect(Collectors.toList());
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

    public String getComment() {
        return comment;
    }

    public List<Map<String, String>> getComms() {
        return comms;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
