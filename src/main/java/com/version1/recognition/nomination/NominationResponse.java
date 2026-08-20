package com.version1.recognition.nomination;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class NominationResponse {

    private final UUID id;
    private final String nominatorName;
    private final String nomineeName;
    private final String practice;
    private final String location;
    private final String whatText;
    private final String howText;
    private final NominationStatus status;
    private final List<AiFlag> aiFlags;
    private final String rejectionReason;
    private final UUID originalNominationId;
    private final Instant submittedAt;
    private final Instant decisionDate;
    private final Instant commsSentDate;
    /** Completeness check. Null when the caller didn't ask for one. */
    private final EvaluationResponse evaluation;

    public NominationResponse(Nomination nomination) {
        this(nomination, null);
    }

    public NominationResponse(Nomination nomination, NominationEvaluation evaluation) {
        this.evaluation = evaluation == null ? null : new EvaluationResponse(evaluation);
        this.id = nomination.getId();
        this.nominatorName = nomination.getNominatorName();
        this.nomineeName = nomination.getNomineeName();
        this.practice = nomination.getPractice();
        this.location = nomination.getLocation();
        this.whatText = nomination.getWhatText();
        this.howText = nomination.getHowText();
        this.status = nomination.getStatus();
        this.aiFlags = nomination.getAiFlags();
        this.rejectionReason = nomination.getRejectionReason();
        this.originalNominationId = nomination.getOriginalNominationId();
        this.submittedAt = nomination.getSubmittedAt();
        this.decisionDate = nomination.getDecisionDate();
        this.commsSentDate = nomination.getCommsSentDate();
    }

    public UUID getId() {
        return id;
    }

    public String getNominatorName() {
        return nominatorName;
    }

    public String getNomineeName() {
        return nomineeName;
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

    public List<AiFlag> getAiFlags() {
        return aiFlags;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public UUID getOriginalNominationId() {
        return originalNominationId;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getDecisionDate() {
        return decisionDate;
    }

    public Instant getCommsSentDate() {
        return commsSentDate;
    }

    public EvaluationResponse getEvaluation() {
        return evaluation;
    }
}
