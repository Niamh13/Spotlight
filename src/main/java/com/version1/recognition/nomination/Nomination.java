package com.version1.recognition.nomination;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "nominations")
public class Nomination {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String nominatorName;

    @Column(nullable = false)
    private String nominatorEmail;

    @Column(nullable = false)
    private String nomineeName;

    @Column(nullable = false)
    private String nomineeEmail;

    @Column(nullable = false)
    private String practice;

    @Column(nullable = false)
    private String location;

    // WHAT: the achievement, contribution, or action
    @Lob
    @Column(nullable = false)
    private String whatText;

    // HOW: how it demonstrated a Version 1 core value
    @Lob
    @Column(nullable = false)
    private String howText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NominationStatus status;

    // Advisory only - the coordinator makes the decision, AI never does (Epic 2).
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "nomination_ai_flags", joinColumns = @JoinColumn(name = "nomination_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "flag")
    private List<AiFlag> aiFlags = new ArrayList<>();

    // Set when a coordinator rejects (Epic 3) - mandatory at that point, null until then.
    @Lob
    private String rejectionReason;

    // Links a resubmission back to the nomination it replaces (Epic 3).
    private UUID originalNominationId;

    // Who made the approve/reject call (Epic 3).
    private String coordinatorEmail;

    @Column(nullable = false)
    private Instant submittedAt;

    private Instant decisionDate;

    private Instant commsSentDate;

    protected Nomination() {
        // required by JPA
    }

    public Nomination(String nominatorName, String nominatorEmail, String nomineeName, String nomineeEmail,
                       String practice, String location, String whatText, String howText,
                       UUID originalNominationId) {
        this.nominatorName = nominatorName;
        this.nominatorEmail = nominatorEmail;
        this.nomineeName = nomineeName;
        this.nomineeEmail = nomineeEmail;
        this.practice = practice;
        this.location = location;
        this.whatText = whatText;
        this.howText = howText;
        this.originalNominationId = originalNominationId;
        this.status = NominationStatus.PENDING_REVIEW;
        this.submittedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getNominatorName() {
        return nominatorName;
    }

    public String getNominatorEmail() {
        return nominatorEmail;
    }

    public String getNomineeName() {
        return nomineeName;
    }

    public String getNomineeEmail() {
        return nomineeEmail;
    }

    public String getPractice() {
        return practice;
    }

    public String getLocation() {
        return location;
    }

    public String getWhatText() {
        return whatText;
    }

    public String getHowText() {
        return howText;
    }

    public NominationStatus getStatus() {
        return status;
    }

    public void setStatus(NominationStatus status) {
        this.status = status;
    }

    public List<AiFlag> getAiFlags() {
        return aiFlags;
    }

    public void setAiFlags(List<AiFlag> aiFlags) {
        this.aiFlags = aiFlags;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public UUID getOriginalNominationId() {
        return originalNominationId;
    }

    public String getCoordinatorEmail() {
        return coordinatorEmail;
    }

    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getDecisionDate() {
        return decisionDate;
    }

    public void setDecisionDate(Instant decisionDate) {
        this.decisionDate = decisionDate;
    }

    public Instant getCommsSentDate() {
        return commsSentDate;
    }

    public void setCommsSentDate(Instant commsSentDate) {
        this.commsSentDate = commsSentDate;
    }
}
