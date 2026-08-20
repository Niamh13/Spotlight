package com.version1.recognition.nomination;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A record that a resubmission was asked for, and what was asked for.
 * <p>
 * Persisted rather than derived so there is an audit trail of what the
 * nominator was actually told - the criteria are re-evaluated on every read, so
 * without this row a later tweak to {@link NominationEvaluator} would silently
 * rewrite history.
 */
@Entity
@Table(name = "resubmission_requests")
public class ResubmissionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID nominationId;

    /** The nominator - they wrote it, so they're the one who can complete it. */
    @Column(nullable = false)
    private String recipientEmail;

    /** The coordinator who asked for it. Null until Epic 3 brings real accounts. */
    private String requestedByEmail;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "resubmission_request_criteria",
            joinColumns = @JoinColumn(name = "resubmission_request_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "criterion")
    private List<EvaluationCriterion> failingCriteria = new ArrayList<>();

    /** The message as sent, kept verbatim so the audit trail is the real text. */
    @Lob
    @Column(nullable = false)
    private String message;

    @Column(nullable = false)
    private Instant sentAt;

    protected ResubmissionRequest() {
        // required by JPA
    }

    public ResubmissionRequest(UUID nominationId, String recipientEmail, String requestedByEmail,
                               List<EvaluationCriterion> failingCriteria, String message, Instant sentAt) {
        this.nominationId = nominationId;
        this.recipientEmail = recipientEmail;
        this.requestedByEmail = requestedByEmail;
        this.failingCriteria = new ArrayList<>(failingCriteria);
        this.message = message;
        this.sentAt = sentAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getNominationId() {
        return nominationId;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public String getRequestedByEmail() {
        return requestedByEmail;
    }

    public List<EvaluationCriterion> getFailingCriteria() {
        return failingCriteria;
    }

    public String getMessage() {
        return message;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
