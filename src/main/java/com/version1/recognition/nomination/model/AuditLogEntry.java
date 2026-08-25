package com.version1.recognition.nomination.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "nomination_audit_log")
public class AuditLogEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.CHAR)
    private UUID id;

    @Column(nullable = false)
    @JdbcTypeCode(SqlTypes.CHAR)
    private UUID nominationId;

    @Column(nullable = false)
    private String coordinatorEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuditAction action;

    // The message the nominator is told. Mandatory for REJECTED and
    // RESUBMISSION_REQUESTED, null for APPROVED.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String reason;

    // The coordinator's own note. Deliberately separate from `reason`: one is
    // sent to the nominator, the other is internal context for whoever picks
    // this up next. Conflating them means either the nominator reads a note
    // meant for colleagues, or the note is never written at all.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String comment;

    // Every message this decision generated. Approving produces two - one to the
    // nominator, one to the nominee - which is why this is a collection.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "nomination_audit_comms",
            joinColumns = @JoinColumn(name = "audit_log_id"))
    private List<SentComm> comms = new ArrayList<>();

    @Column(nullable = false)
    private Instant occurredAt;

    protected AuditLogEntry() {
        // required by JPA
    }

    public AuditLogEntry(UUID nominationId, String coordinatorEmail, AuditAction action, String reason) {
        this(nominationId, coordinatorEmail, action, reason, null);
    }

    public AuditLogEntry(UUID nominationId, String coordinatorEmail, AuditAction action,
                          String reason, String comment) {
        this.nominationId = nominationId;
        this.coordinatorEmail = coordinatorEmail;
        this.action = action;
        this.reason = reason;
        this.comment = comment;
        this.occurredAt = Instant.now();
    }

    /** Records a message this decision generated. Call once per recipient. */
    public void recordComm(SentComm comm) {
        this.comms.add(comm);
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

    public String getComment() {
        return comment;
    }

    public List<SentComm> getComms() {
        return comms;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
